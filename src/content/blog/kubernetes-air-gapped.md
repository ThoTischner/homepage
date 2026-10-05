---
title: "Kubernetes air-gapped: Betrieb in abgeschotteten Netzen"
description: "Kubernetes air-gapped betreiben: Transferstrecke, Harbor, cosign-Signaturen, Offline-Scans, GitOps und Upgrades für OpenShift, Tanzu und Vanilla-Cluster."
pubDate: 2026-10-06
tags: ["Kubernetes", "Air-Gapped", "Supply Chain Security", "OpenShift", "Harbor"]
summary: "Ein air-gapped Kubernetes-Betrieb steht und fällt mit der Artefakt-Kette: Jedes Image, Chart, Paket, Modell und jede Schwachstellen-Datenbank muss über eine kontrollierte Transferstrecke in eine interne Registry gelangen und dort per Signatur verifizierbar sein. Der Cluster selbst ist selten das Problem, vergessene Laufzeit-Abhängigkeiten und fehlende Prozesse für regelmäßige Updates sind es fast immer."
faq:
  - q: "Was bedeutet air-gapped bei Kubernetes?"
    a: "Air-gapped heißt, dass Cluster und Nodes keine Netzverbindung ins Internet haben, auch nicht über einen Proxy. Alle Artefakte wie Container-Images, Helm-Charts, OS-Pakete und Schwachstellen-Datenbanken werden außerhalb heruntergeladen, geprüft und über eine kontrollierte Transferstrecke in interne Registries eingespielt. Davon zu unterscheiden sind teilweise abgeschottete Umgebungen mit Proxy oder Datendiode."
  - q: "Wie konfiguriert man einen Registry-Mirror für containerd?"
    a: "Seit containerd 2.x wird die Registry-Konfiguration über hosts.toml-Dateien unter einem config_path wie /etc/containerd/certs.d gesteuert, die alte Inline-Konfiguration registry.mirrors ist deprecated. Pro Upstream-Registry legt man ein Verzeichnis an und trägt dort die interne Registry als host mit den Capabilities pull und resolve sowie dem internen CA-Zertifikat ein."
  - q: "Wie verifiziert man Image-Signaturen mit cosign ohne Internet?"
    a: "Für eigene Images signiert man mit einem Schlüssel aus KMS oder HSM und verifiziert mit cosign verify --key, bei fehlendem Transparency Log zusätzlich mit --insecure-ignore-tlog. Für keyless signierte Upstream-Images müssen Signatur-Bundles mit dem Image transferiert und eine Sigstore-TrustedRoot-Datei per --trusted-root bereitgestellt werden. Im Cluster setzt ein Admission-Controller die Prüfung durch."
  - q: "Wie aktualisiert man OpenShift in einer disconnected Umgebung?"
    a: "Red Hat stellt dafür das oc-mirror-Plugin v2 bereit, das Release-Images, Operator-Kataloge, Helm-Charts und weitere Images per ImageSetConfiguration auf Datenträger spiegelt und intern in eine Registry lädt. Es erzeugt dabei passende Cluster-Ressourcen wie ImageDigestMirrorSet und CatalogSource. oc-mirror v1 ist seit OpenShift 4.18 deprecated, für Update-Empfehlungen im Cluster kann der OpenShift Update Service intern betrieben werden."
  - q: "Wie bekommen Data-Science-Teams Python-Pakete und KI-Modelle in ein air-gapped Netz?"
    a: "Über interne Mirrors für PyPI und Conda, etwa in Nexus, Artifactory oder devpi, die über die Transferstrecke befüllt werden, und über ein internes Modell-Repository, zum Beispiel einen S3-kompatiblen Object Store. Clients werden per pip.conf bzw. .condarc auf die internen Quellen konfiguriert, Hugging-Face-Bibliotheken mit HF_HUB_OFFLINE=1 auf reinen Cache-Betrieb."
sources:
  - title: "containerd: Registry Configuration (hosts.toml)"
    url: "https://github.com/containerd/containerd/blob/main/docs/hosts.md"
  - title: "Harbor: Creating a Replication Rule"
    url: "https://goharbor.io/docs/main/administration/configuring-replication/create-replication-rules/"
  - title: "Sigstore: Verifying Signatures with Cosign"
    url: "https://docs.sigstore.dev/cosign/verifying/verify/"
  - title: "Red Hat OpenShift 4.22: Mirroring images for a disconnected installation by using the oc-mirror plugin v2"
    url: "https://docs.redhat.com/en/documentation/openshift_container_platform/4.22/html/disconnected_environments/about-installing-oc-mirror-v2"
  - title: "Trivy: Air-Gapped Environment"
    url: "https://trivy.dev/docs/latest/guide/advanced/air-gap/"
  - title: "Hugging Face Hub: Environment variables"
    url: "https://huggingface.co/docs/huggingface_hub/package_reference/environment_variables"
---

Kubernetes ist für einen Betrieb mit Internetzugang gebaut. Jede Installationsanleitung zieht Images von registry.k8s.io, jedes Helm-Chart verweist auf öffentliche Repositories, jeder Operator lädt irgendwann irgendetwas nach. In Behörden, kritischer Infrastruktur und Teilen der Industrie ist genau das ausgeschlossen. Dieser Artikel beschreibt, was ein abgeschotteter Kubernetes-Betrieb technisch und organisatorisch verlangt.

Er richtet sich an Plattform-Teams und Architekt:innen, die so eine Umgebung aufbauen oder übernehmen. Die Beispiele beziehen sich auf containerd 2.x, Harbor 2.15, cosign 3.1, Trivy und das oc-mirror-Plugin v2 von OpenShift. Stand: Oktober 2026, aktuelle Kubernetes-Minor-Versionen sind 1.35 bis 1.37.

## Abstufungen: Nicht jedes „air-gapped“ ist gleich

Der Begriff wird unscharf verwendet. Für die Architektur ist die Unterscheidung aber entscheidend, weil sie festlegt, welche Werkzeuge überhaupt funktionieren.

Vollständig air-gapped bedeutet: keine Netzverbindung nach außen, auch nicht indirekt. Daten kommen über Wechseldatenträger oder eine dedizierte Transferstation ins Netz, oft mit Vier-Augen-Prinzip und Malware-Scan in einer Schleuse.

Teilweise abgeschottet ist die häufigere Variante. Hier gibt es einen Proxy mit Allowlist, eine Registry in einer DMZ, die nach außen replizieren darf, oder eine Datendiode, die Daten nur in eine Richtung durchlässt. Red Hat nennt das „partially disconnected“ und unterstützt dafür einen Mirror-to-Mirror-Modus.

Die Datendiode verdient einen eigenen Hinweis. Ohne Rückkanal gibt es kein TCP-Handshake, also keine Registry-Replikation über HTTPS und keine Bestätigung, dass ein Transfer vollständig ankam. Man braucht dateibasierte Formate, Prüfsummen-Manifeste und eine Empfangsseite, die selbstständig validiert und importiert.

## Die Artefakt-Kette als zentrales Designobjekt

Der Kubernetes-Cluster ist der einfache Teil. Die eigentliche Plattform ist die Lieferkette, die Artefakte von außen nach innen bringt. Sie sollte entworfen werden wie ein Produkt, mit klarer Definition, was transportiert wird, wer freigibt und wie man Fehler erkennt.

Zur Kette gehören mehr Artefakttypen, als zu Beginn auf der Liste stehen:

- Container-Images inklusive Signaturen, Attestations und SBOMs als OCI-Referrer
- Helm-Charts, idealerweise als OCI-Artefakte
- OS-Pakete und Node-Images (RPM/DEB-Repositories, OVA-Templates, RHCOS-Images)
- Operator-Kataloge und Crossplane-Provider-Pakete
- Python-, Conda-, npm- oder Maven-Pakete für Entwicklungs- und Data-Science-Teams
- KI-Modelle und Datasets
- Schwachstellen-Datenbanken und Policy-Bundles
- Binaries für CLIs (kubectl, helm, oc, argocd, cosign)

Bewährt hat sich ein Aufbau mit drei Zonen. Auf der verbundenen Seite steht ein Build- bzw. Mirror-Host, der deklarativ beschriebene Artefaktlisten herunterlädt, Signaturen der Hersteller prüft, scannt und alles in ein Archiv mit Prüfsummen packt. In der Transferzone wird das Archiv erneut geprüft und freigegeben. Auf der abgeschotteten Seite importiert ein Job das Archiv in die interne Registry und verifiziert dabei erneut.

Die Artefaktlisten selbst gehören in Git, mit Pull-Request und Review. Wer ein neues Image braucht, stellt einen Änderungsantrag gegen diese Liste. Das ist die Stelle, an der Sicherheitsfreigabe und Plattform-Self-Service zusammenkommen.

## Interne Registry: Harbor als Drehscheibe

Für die interne Registry ist Harbor im On-Premises-Umfeld die naheliegende Wahl, alternativ Quay, Nexus oder Artifactory. Harbor bringt Projekte mit RBAC, Replikation, Proxy-Cache, integriertes Trivy-Scanning, Retention-Regeln und Unterstützung für OCI-Artefakte wie Helm-Charts und cosign-Signaturen mit.

Replikationsregeln können Push- oder Pull-basiert sein, nach Name, Tag, Label und Ressourcentyp filtern und manuell, per Cron oder ereignisbasiert ausgelöst werden. In teilweise abgeschotteten Setups repliziert eine Harbor-Instanz in der DMZ per Pull von Upstream-Registries, eine zweite Instanz im inneren Netz zieht per Pull von der DMZ-Instanz. Bandbreitenlimit und „Copy by Chunk“ helfen bei großen Images über schmale Leitungen. Bei mehreren Standorten repliziert man zusätzlich zwischen den inneren Instanzen, statt jeden Standort einzeln über die Transferstrecke zu bedienen.

Der Proxy-Cache von Harbor ist nur in teilweise verbundenen Netzen sinnvoll. Er lädt beim ersten Pull vom Upstream und liefert danach aus dem Cache. Für Umgebungen mit Freigabepflicht ist er gefährlich, weil damit jede beliebige Image-Referenz ohne Review ins Netz kommt. Ich würde ihn dort nur für explizit freigegebene Upstream-Projekte erlauben.

### containerd auf interne Registries umbiegen

Damit Workloads und Systemkomponenten ihre Original-Referenzen behalten können, konfiguriert man containerd so, dass Pulls auf die interne Registry umgeleitet werden. Seit containerd 2.x läuft das ausschließlich über `hosts.toml`, das alte `registry.mirrors` in der Hauptkonfiguration ist deprecated.

```toml
# /etc/containerd/config.toml (Ausschnitt, config version 3)
version = 3

[plugins."io.containerd.cri.v1.images".registry]
  config_path = "/etc/containerd/certs.d"
```

```toml
# /etc/containerd/certs.d/registry.k8s.io/hosts.toml
server = "https://registry.k8s.io"

[host."https://harbor.example.com/v2/mirror-k8s"]
  capabilities = ["pull", "resolve"]
  ca = "/etc/containerd/certs.d/harbor.example.com/ca.crt"
  override_path = true
```

`override_path = true` ist nötig, weil der Pfad zum Harbor-Projekt Teil der URL ist. Das gleiche Muster wiederholt man für docker.io, quay.io, ghcr.io, nvcr.io und jede weitere Upstream-Registry. Die Fallback-Adresse unter `server` ist im vollständig abgeschotteten Netz nicht erreichbar, das ist gewollt: Ein fehlendes Image fällt sofort als Pull-Fehler auf.

Bei OpenShift übernimmt CRI-O diese Rolle, konfiguriert über `ImageDigestMirrorSet` und `ImageTagMirrorSet`. Bei vSphere mit Tanzu (heute vSphere Kubernetes Service) werden Registry-Zertifikate und Mirrors über die Cluster-Spezifikation eingebracht, nicht manuell auf den Nodes.

## Signaturen und SBOMs: Vertrauen über die Transferstrecke tragen

Eine Transferstrecke ohne kryptografische Prüfung ist nur ein langsamer Download. Ziel ist, dass das innere Netz selbst prüfen kann, ob ein Artefakt freigegeben wurde, unabhängig davon, wer es auf den Datenträger kopiert hat.

Dafür eignen sich cosign und das Sigstore-Ökosystem. Cosign 3 nutzt standardmäßig das vereinheitlichte Sigstore-Bundle-Format und legt Signaturen als OCI-1.1-Referrer neben dem Image ab. Für air-gapped Umgebungen gibt es zwei Muster.

Für eigene Freigaben signiert die Transferzone jedes geprüfte Image mit einem Schlüssel aus KMS oder HSM. Ein öffentliches Transparency Log ist von innen nicht erreichbar, daher wird entweder eine eigene Sigstore-Instanz (Rekor, Fulcio, Timestamp Authority) betrieben oder bewusst ohne Log verifiziert:

```bash
cosign verify \
  --key cosign.pub \
  --insecure-ignore-tlog=true \
  harbor.example.com/team-a/app@sha256:<digest>

cosign verify-attestation \
  --key cosign.pub \
  --insecure-ignore-tlog=true \
  --type spdxjson \
  harbor.example.com/team-a/app@sha256:<digest>
```

Für Upstream-Images, die der Hersteller keyless signiert hat, prüft man auf der verbundenen Seite gegen Identität und OIDC-Issuer des Herstellers. Soll die Herstellersignatur auch innen prüfbar bleiben, müssen Signatur-Bundles mit dem Image transportiert werden (etwa per `cosign save` und `cosign load`) und eine Sigstore-TrustedRoot-Datei über `--trusted-root` bereitstehen. Diese Datei enthält Zertifikate mit Ablaufdatum und muss selbst Teil der regelmäßigen Transfers sein.

Im Cluster muss ein Admission-Controller unsignierte Images ablehnen, typischerweise Kyverno oder der Sigstore Policy Controller. Immer per Digest referenzieren, nie per Tag: Tags sind veränderlich, Signaturen gelten für Digests.

## Schwachstellenscans ohne Internet

Scanner sind nur so gut wie ihre Datenbank. Trivy lädt seine Datenbanken als OCI-Artefakte, was im air-gapped Betrieb ein Vorteil ist: Sie lassen sich wie Images transportieren.

```bash
# Verbundene Seite: Datenbanken als OCI-Layout exportieren
oras copy --to-oci-layout ghcr.io/aquasecurity/trivy-db:2 ./transfer/trivy-db:2
oras copy --to-oci-layout ghcr.io/aquasecurity/trivy-java-db:1 ./transfer/trivy-java-db:1

# Innen: in Harbor importieren
oras copy --from-oci-layout ./transfer/trivy-db:2 harbor.example.com/mirror/trivy-db:2
oras copy --from-oci-layout ./transfer/trivy-java-db:1 harbor.example.com/mirror/trivy-java-db:1

# Scannen gegen die interne Kopie
trivy image \
  --db-repository harbor.example.com/mirror/trivy-db:2 \
  --java-db-repository harbor.example.com/mirror/trivy-java-db:1 \
  --skip-version-check --disable-telemetry \
  harbor.example.com/team-a/app@sha256:<digest>
```

Ohne `--skip-version-check` und `--disable-telemetry` versucht Trivy weiterhin, nach außen zu telefonieren. Das erzeugt Timeouts und Firewall-Alarme. Der in Harbor integrierte Trivy-Adapter braucht dieselbe Behandlung über seine eigene Konfiguration.

Der fachliche Punkt wird oft übersehen: Eine Datenbank, die wöchentlich über die Transferstrecke kommt, ist im Schnitt mehrere Tage alt. Ein Image, das heute als sauber gilt, kann morgen eine kritische CVE haben. Deshalb reicht der Scan beim Import nicht. Laufende Images müssen nach jedem Datenbank-Update erneut bewertet werden, und die Transferfrequenz für Scanner-Daten sollte höher sein als für alles andere.

## GitOps ohne Internet

GitOps funktioniert in abgeschotteten Netzen sogar besser als anderswo, weil es den gewünschten Zustand als prüfbares Artefakt festhält. Argo CD läuft gegen ein internes Git (GitLab, Gitea, Bitbucket) und zieht Helm-Charts aus der internen Registry per OCI. Die Details zu Multi-Cluster-Setups beschreibe ich in [Argo CD Multi-Cluster GitOps](/blog/argocd-multi-cluster-gitops/).

In abgeschotteten Umgebungen, die ich betreut habe, liefen Argo CD und Crossplane vollständig gegen interne Quellen. Die meiste Arbeit steckte dabei nicht in Argo CD selbst, sondern darin, Charts von externen Abhängigkeiten zu befreien. Crossplane-Provider sind OCI-Pakete und müssen ebenfalls gespiegelt werden, siehe [Crossplane als Plattform-API](/blog/crossplane-plattform-apis/).

Konkret heißt das: Helm-Dependencies in `Chart.yaml` auf interne OCI-Repositories umstellen, Image-Referenzen in Values auf interne Registries oder Digests setzen, und die interne CA in Argo CD hinterlegen, damit Repo-Server und Registry-Zugriffe TLS-Prüfung bestehen.

## Zertifikate, PKI und Zeit

Ohne öffentliche CA und ohne ACME braucht jede abgeschottete Plattform eine interne PKI. Typisch ist eine Offline-Root-CA, eine Issuing-CA in Vault oder einer vorhandenen Unternehmens-PKI und cert-manager im Cluster. Die Root-CA muss in Node-Images, Container-Basis-Images, Java-Truststores und Python-Umgebungen verteilt werden. Letzteres scheitert regelmäßig, weil `requests` und `pip` eigene CA-Bundles mitbringen.

Zeit wird unterschätzt. Zertifikatsprüfung, Token-Gültigkeit, etcd und Signaturverifikation brauchen synchrone Uhren. Ohne öffentliche NTP-Server braucht man eine interne Zeitquelle, zum Beispiel einen GPS- oder funkgestützten Stratum-1-Server, und eine Überwachung des Drifts. Ein Cluster, dessen Uhren auseinanderlaufen, zeigt Fehlerbilder, die zunächst niemand mit Zeit in Verbindung bringt.

Interne Service-zu-Service-Verschlüsselung per Mesh hängt ebenfalls an dieser PKI, siehe [Istio mTLS und Zero Trust](/blog/istio-mtls-zero-trust/).

## Updates und Upgrades

Upgrades sind in abgeschotteten Netzen planbare Projekte mit Artefakt-Vorlauf. Kubernetes erlaubt keine übersprungenen Minor-Versionen, also müssen die Artefakte für jeden Zwischenschritt transportiert werden. Bei drei unterstützten Minor-Versionen und rund einem Jahr Support pro Version ist ein Rhythmus von mindestens zwei Upgrades pro Jahr Pflicht, sonst läuft man aus dem Support.

Bei Vanilla-Kubernetes mit kubeadm setzt man `imageRepository` in der `ClusterConfiguration` auf die interne Registry und spiegelt vorher die von `kubeadm config images list` ausgegebenen Images.

Für OpenShift ist das oc-mirror-Plugin v2 der vorgesehene Weg, v1 ist seit 4.18 deprecated. Eine `ImageSetConfiguration` beschreibt Releases, Operatoren, Helm-Charts und Zusatz-Images:

```yaml
apiVersion: mirror.openshift.io/v2alpha1
kind: ImageSetConfiguration
mirror:
  platform:
    channels:
      - name: stable-4.21
        minVersion: 4.21.10
        maxVersion: 4.21.14
    graph: true
  operators:
    - catalog: registry.redhat.io/redhat/redhat-operator-index:v4.21
      packages:
        - name: openshift-gitops-operator
  additionalImages:
    - name: registry.redhat.io/ubi9/ubi-minimal:latest
```

```bash
# Verbundene Seite: auf Datenträger spiegeln
oc-mirror -c ./isc.yaml file:///data/oc-mirror --v2

# Innen: vom Datenträger in die interne Registry
oc-mirror -c ./isc.yaml --from file:///data/oc-mirror docker://registry.example.com:8443 --v2
```

oc-mirror erzeugt im Arbeitsverzeichnis unter `cluster-resources` die passenden `ImageDigestMirrorSet`-, `ImageTagMirrorSet`- und `CatalogSource`-Ressourcen sowie Signatur-ConfigMaps für Release-Images. `graph: true` bringt die Update-Graph-Daten mit, die der intern betriebene OpenShift Update Service braucht, damit `oc adm upgrade` sinnvolle Pfade anzeigt. Versionsnummern im Beispiel sind exemplarisch, die Kanäle sollten zur eigenen Zielversion passen.

Bei vSphere mit Tanzu kommen Kubernetes-Releases als Images in eine lokale Content Library, die man in abgeschotteten Netzen manuell importiert. Supervisor-Services und deren Images sind ein eigener Transferpfad.

## Abhängigkeiten, die fast immer vergessen werden

Die folgenden Punkte sorgen in der Praxis für die meisten Überraschungen nach dem Go-live:

- Operator-Kataloge: Ein gespiegelter Katalog ohne die referenzierten Bundle- und Operand-Images installiert, aber startet nicht.
- Helm-Charts mit Init-Containern, Hooks oder Sub-Charts, deren Images nicht in `values.yaml` auftauchen. `helm template` und ein Extrahieren aller `image:`-Felder gehören in die Pipeline.
- Komponenten, die zur Laufzeit nachladen: der NVIDIA GPU Operator benötigt Treiber-Images passend zu Kernel und OS-Version, KServe zieht Modelle über einen Storage-Initializer, Grafana-Plugins und Dashboards kommen standardmäßig von grafana.com.
- Paket-Registries für Data-Science-Teams. Ohne interne PyPI- und Conda-Mirrors baut niemand ein Notebook-Image.
- KI-Modelle. Gewichte großer Sprachmodelle umfassen leicht dreistellige Gigabyte-Zahlen pro Modell und sprengen Transferprozesse, die für Images ausgelegt sind.

Für Python-Umgebungen reicht meist eine zentrale Konfiguration im Basis-Image:

```ini
# /etc/pip.conf
[global]
index-url = https://nexus.example.com/repository/pypi-proxy/simple
cert = /etc/pki/tls/certs/internal-ca.pem
```

Für Modelle hat sich ein interner S3-kompatibler Object Store (etwa MinIO) als Modell-Repository bewährt, in den freigegebene Modelle mit Prüfsumme und Lizenzprüfung abgelegt werden. Bibliotheken von Hugging Face sollten mit `HF_HUB_OFFLINE=1` laufen, dann machen sie keine HTTP-Aufrufe zum Hub und arbeiten nur mit dem lokalen Cache unter `HF_HUB_CACHE`. Für die Inferenz-Seite mit KServe und vLLM verweise ich auf [LLM-Inference mit KServe und vLLM](/blog/kserve-vllm-llm-inference/).

## Betrieb und Observability ohne SaaS

Datadog, Grafana Cloud, Sentry und ähnliche Dienste fallen weg. Übrig bleibt ein selbst betriebener Stack, meist Prometheus oder ein kompatibles Langzeit-Backend, Loki oder OpenSearch für Logs, Tempo oder Jaeger für Traces und Grafana für Dashboards. Das ist machbar, kostet aber Kapazität im Plattform-Team und sollte bei der Personalplanung auftauchen.

Zwei Details: Alerting braucht interne Kanäle (SMTP, interner Chat, Leitstelle), Push-Dienste von Mobilgeräten funktionieren nicht. Und eingebaute Telemetrie muss aktiv abgeschaltet werden, bei OpenShift etwa das Remote-Health-Reporting, sonst produziert sie dauerhaft fehlgeschlagene Verbindungen.

Support-Fälle beim Hersteller laufen über exportierte Diagnosepakete (`oc adm must-gather`, Support-Bundles), die ihrerseits den Weg nach außen über eine Freigabe nehmen. Diese Richtung braucht ebenso einen definierten Prozess wie der Import, inklusive Prüfung auf sensible Daten.

## Prozesse und Freigaben

Technisch ist die Transferstrecke ein Pipeline-Problem, organisatorisch ein Freigabeproblem. Was sich bewährt:

- Ein fester Transferrhythmus, zum Beispiel wöchentlich für Scanner-Daten und Patches, monatlich für neue Versionen, plus ein dokumentierter Notfallpfad für kritische CVEs.
- Freigabekriterien als Code: Signatur des Herstellers gültig, keine kritischen CVEs ohne Ausnahme, SBOM vorhanden, Lizenz zulässig.
- Nachvollziehbarkeit: Jedes Artefakt im inneren Netz lässt sich über Digest und Signatur auf einen Transfer und eine Freigabe zurückführen.

Der häufigste organisatorische Fehler ist, die Transferstrecke als Einmalaufwand beim Aufbau zu behandeln. Sie ist ein Dauerbetrieb mit eigenem Verantwortlichen.

## Einordnung

Ein vollständig air-gapped Kubernetes ist sinnvoll, wenn regulatorische Vorgaben oder Schutzbedarf es verlangen, etwa bei besonders schutzbedürftigen Daten, Leitsystemen kritischer Infrastruktur oder Produktionsnetzen mit Safety-Bezug. Dann ist es mit heutigen Werkzeugen gut beherrschbar: Harbor, cosign, Trivy mit OCI-Datenbanken und oc-mirror decken die Kette ab.

Wo es nur um Risikoreduktion geht, ist eine teilweise abgeschottete Variante mit DMZ-Registry, Allowlist-Proxy und konsequenter Signaturprüfung meist das bessere Verhältnis aus Sicherheit und Betriebsaufwand. Ein vollständiger Air Gap verlangsamt Patches, und ein schlecht gepatchter isolierter Cluster ist nicht automatisch sicherer als ein gut gepatchter verbundener.

Meine Empfehlung: zuerst die Artefakt-Kette entwerfen und automatisieren, dann die Cluster. Wer mit der Registry und den Freigabeprozessen beginnt, hat später bei jedem Upgrade weniger Arbeit. Für Teams, die vor genau dieser Aufgabe stehen, beschreibe ich unter [Leistungen](/#leistungen) meine Unterstützung, erreichbar bin ich über den [Kontakt](/#kontakt).
