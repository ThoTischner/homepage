---
title: "mTLS mit Istio: Zero Trust im Cluster Schritt für Schritt"
description: "mTLS mit Istio 1.31 in der Praxis: SPIFFE-Identitäten, Sidecar vs. Ambient, Migration auf STRICT ohne Ausfall, Default-Deny und eigene PKI mit Vault."
pubDate: 2026-10-06
tags: ["Istio", "mTLS", "Zero Trust", "Kubernetes Security", "Service Mesh"]
summary: "Istio gibt jedem Workload eine kurzlebige X.509-Identität im SPIFFE-Format und verschlüsselt Service-zu-Service-Verkehr per mTLS. Zero Trust entsteht aber erst durch PeerAuthentication im Modus STRICT plus AuthorizationPolicies mit Default-Deny, die Zugriffe an Identitäten statt an IP-Adressen binden. In regulierten Umgebungen gehört die Root-CA in eine externe PKI, etwa HashiCorp Vault über cert-manager istio-csr."
faq:
  - q: "Wie stellt man Istio von PERMISSIVE auf STRICT um, ohne Ausfall?"
    a: "Zuerst alle Workloads in den Mesh holen und per Metrik prüfen, dass kein Klartext-Verkehr mehr ankommt, etwa über das Label connection_security_policy an istio_requests_total und istio_tcp_connections_opened_total. Danach STRICT namespaceweise per PeerAuthentication setzen und erst zuletzt meshweit im Root-Namespace istio-system. Bekannte Nicht-Mesh-Clients bekommen vorher gezielte, dokumentierte Ausnahmen."
  - q: "Ist der Istio Ambient-Modus produktionsreif?"
    a: "Ja, der Ambient-Modus ist seit Istio 1.24 (November 2024) GA, ztunnel und Waypoints werden in der Feature-Status-Liste als Stable geführt. Ambient Multicluster über mehrere Netzwerke ist laut Istio dagegen Beta und ausdrücklich noch nicht für den Produktivbetrieb gedacht, Single-Network-Multicluster ist Alpha (Stand: Oktober 2026, Istio 1.31)."
  - q: "Wie sieht eine SPIFFE-ID in Istio aus?"
    a: "Istio vergibt Identitäten im Format spiffe://<trust-domain>/ns/<namespace>/sa/<serviceaccount>, standardmäßig mit der Trust Domain cluster.local. Die Identität hängt also am Kubernetes-ServiceAccount, nicht an Pod-IP oder Hostname. In AuthorizationPolicies schreibt man sie ohne das Präfix spiffe://, etwa cluster.local/ns/team-a/sa/frontend."
  - q: "Kann Istio Zertifikate aus HashiCorp Vault beziehen?"
    a: "Istio hat keine direkte Vault-Anbindung im Kern, der übliche Weg ist cert-manager mit einem Vault-Issuer und istio-csr als Ersatz für die eingebaute CA von istiod. Alternativ lässt sich ein in Vault erzeugtes Intermediate als Secret cacerts einspielen, dann liegt der CA-Schlüssel allerdings im Cluster. istio-csr muss vor Istio installiert werden, ein nachträglicher Umbau wird nicht unterstützt."
  - q: "Warum schlagen Health-Checks mit STRICT mTLS nicht fehl?"
    a: "Im Sidecar-Modus schreibt Istio HTTP-, TCP- und gRPC-Probes standardmäßig so um, dass der Kubelet den Istio-Agent anspricht, der die Prüfung an die Anwendung weiterreicht. Im Ambient-Modus markiert istio-cni Kubelet-Verkehr per SNAT mit der link-lokalen Adresse 169.254.7.127, die ztunnel von der Policy-Durchsetzung ausnimmt. Eine vorhandene NetworkPolicy muss diese Adresse erlauben."
sources:
  - title: "Istio: Security Concepts"
    url: "https://istio.io/latest/docs/concepts/security/"
  - title: "Istio: Announcing Istio 1.31"
    url: "https://istio.io/latest/news/releases/1.31.x/announcing-1.31/"
  - title: "Istio: Mutual TLS Migration"
    url: "https://istio.io/latest/docs/tasks/security/authentication/mtls-migration/"
  - title: "Istio: Ztunnel L4 Authorization and Authentication (Ambient)"
    url: "https://istio.io/latest/docs/ambient/usage/l4-policy/"
  - title: "cert-manager: istio-csr"
    url: "https://cert-manager.io/docs/usage/istio-csr/"
  - title: "SPIFFE Concepts"
    url: "https://spiffe.io/docs/latest/spiffe-about/spiffe-concepts/"
---

Ein Kubernetes-Cluster ist intern standardmäßig ein flaches Netz: Jeder Pod erreicht jeden anderen, und der Verkehr läuft unverschlüsselt. NetworkPolicies helfen, arbeiten aber mit Labels und IP-Adressen, nicht mit überprüfbaren Identitäten. Istio schließt diese Lücke mit mutual TLS (mTLS) und identitätsbasierter Autorisierung.

Dieser Artikel richtet sich an Plattform- und SRE-Teams, die mTLS mit Istio produktiv einführen wollen, ohne dabei Anwendungen abzuschießen. Er beschreibt die Reihenfolge, die sich bewährt hat, mit YAML für die aktuelle API `security.istio.io/v1`. Stand: Oktober 2026, aktuelle Version ist Istio 1.31 (offiziell unterstützt auf Kubernetes 1.32 bis 1.36). Istio 1.29 erreicht laut Support-Tabelle am 12. Oktober 2026 das Ende der Unterstützung, wer darauf läuft, sollte jetzt planen.

## Warum Identität wichtiger ist als Verschlüsselung

Verschlüsselung allein schützt vor Mitlesen auf dem Draht. Der eigentliche Gewinn von mTLS ist die beidseitige Authentifizierung: Jeder Workload weist sich mit einem Zertifikat aus, und die Gegenseite kann darauf Entscheidungen treffen.

Istio folgt dabei dem SPIFFE-Standard. Jeder Workload erhält ein X.509-Zertifikat (in SPIFFE-Terminologie ein X.509-SVID), dessen URI-SAN die Identität trägt:

```text
spiffe://cluster.local/ns/team-a/sa/frontend
```

Die Identität leitet sich aus Namespace und ServiceAccount ab. Daraus folgt eine praktische Regel: Wer feingranulare Policies will, braucht pro Anwendung einen eigenen ServiceAccount. Der `default`-ServiceAccount, den sich zehn Deployments teilen, macht jede Policy wertlos.

Der Ablauf der Zertifikatsausstellung ist einfach. Beim Start erzeugt der Istio-Agent (im Sidecar-Modus `pilot-agent`, im Ambient-Modus ztunnel) einen privaten Schlüssel und einen CSR, istiod signiert ihn nach Prüfung des ServiceAccount-Tokens, und Envoy erhält das Zertifikat über die Secret Discovery Service API. Der private Schlüssel verlässt den Knoten nicht. Workload-Zertifikate laufen standardmäßig 24 Stunden und werden automatisch vor Ablauf erneuert. Kurzlebige Zertifikate ersetzen damit in weiten Teilen die Sperrlisten, die in klassischen PKIs selten zuverlässig funktionieren.

## Sidecar oder Ambient

Istio kennt zwei Datenebenen, die beide mTLS liefern, aber unterschiedlich betrieben werden.

Im Sidecar-Modus läuft neben jedem Pod ein Envoy-Proxy. Er terminiert mTLS und setzt L4- und L7-Policies direkt am Ziel-Pod durch. Das ist ausgereift und gut dokumentiert, kostet aber pro Pod CPU und Speicher, und jeder Proxy-Update erfordert einen Neustart der Pods.

Im Ambient-Modus übernimmt ein ztunnel-DaemonSet pro Knoten die L4-Schicht: mTLS über das HBONE-Protokoll (HTTP CONNECT über mTLS, Port 15008) und L4-Autorisierung. L7-Funktionen wie HTTP-Routing oder Policies auf Pfade und Methoden kommen nur dort hinzu, wo man einen Waypoint-Proxy deployt. Ambient ist seit Istio 1.24 GA, ztunnel und Waypoints sind in der Feature-Status-Liste als Stable geführt. Ambient Multicluster über mehrere Netzwerke ist seit 1.29 Beta, laut Istio aber ausdrücklich noch nicht für Produktion gedacht. Istio 1.30 hat einen offiziellen Migrationspfad von Sidecar zu Ambient ergänzt, 1.31 gewichtete Canaries für Waypoints.

Meine Empfehlung für neue Plattformen: Ambient, sofern nicht Multicluster über Netzgrenzen gebraucht wird. Für reine mTLS- und L4-Anforderungen braucht man dort gar keine Envoy-Instanzen pro Anwendung. Bestehende Sidecar-Installationen müssen nicht migrieren, nur weil es Ambient gibt.

Ambient aktiviert man per Namespace-Label, einen Waypoint bei Bedarf mit `istioctl`:

```bash
kubectl label namespace team-a istio.io/dataplane-mode=ambient
istioctl waypoint apply -n team-a --enroll-namespace
```

## PeerAuthentication: von PERMISSIVE zu STRICT

Ohne Konfiguration arbeitet Istio im Modus `PERMISSIVE`: Mesh-Workloads sprechen untereinander mTLS, nehmen aber weiterhin Klartext an. Das ist gut für den Einstieg und schlecht als Endzustand, denn ein Angreifer im Cluster umgeht so die gesamte Identitätsprüfung.

Die Migration auf `STRICT` gelingt ohne Ausfall, wenn man sie messbar macht.

Schritt 1: Alle Workloads in den Mesh holen. Im Sidecar-Modus über das Label `istio.io/rev` bzw. `istio-injection=enabled` und einen Rollout, im Ambient-Modus über das Namespace-Label.

Schritt 2: Klartext-Verkehr sichtbar machen. Die Standardmetriken tragen das Label `connection_security_policy`, das auf der Zielseite `mutual_tls` oder `none` lautet:

```promql
sum by (source_workload, source_workload_namespace, destination_workload) (
  rate(istio_tcp_connections_opened_total{
    reporter="destination",
    connection_security_policy!="mutual_tls"
  }[15m])
)
```

Für HTTP-Verkehr funktioniert dieselbe Abfrage mit `istio_requests_total`. Was hier nach einigen Tagen Laufzeit (inklusive Batch-Jobs und Monatsabschluss, falls relevant) noch auftaucht, ist entweder ein Workload außerhalb des Mesh oder ein Kandidat für eine Ausnahme.

Schritt 3: STRICT namespaceweise setzen, beginnend mit unkritischen Namespaces:

```yaml
apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata:
  name: default
  namespace: team-a
spec:
  mtls:
    mode: STRICT
```

Schritt 4: Erst wenn alle Namespaces umgestellt sind, die meshweite Policy im Root-Namespace anlegen. Namespace-Policies können dann entfallen oder bleiben als dokumentierte Ausnahme bestehen:

```yaml
apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata:
  name: default
  namespace: istio-system
spec:
  mtls:
    mode: STRICT
```

Die Präzedenz ist klar geregelt: Workload-Policy vor Namespace-Policy vor meshweiter Policy. Pro Namespace darf es nur eine Policy ohne Selector geben, weitere werden ignoriert. Das ist eine häufige Fehlerquelle, wenn zwei Teams parallel Policies per GitOps ausrollen.

Im Ambient-Modus gilt eine Besonderheit: `DISABLE` wird nicht unterstützt, weil ztunnel und HBONE immer mTLS sprechen. `STRICT` sorgt dort dafür, dass ztunnel eingehenden Klartext von außerhalb des Mesh ablehnt.

## AuthorizationPolicy: Default-Deny und Identitäten

mTLS beantwortet die Frage, wer spricht. Ob der Zugriff erlaubt ist, entscheidet die AuthorizationPolicy. Istio wertet in fester Reihenfolge aus: erst `CUSTOM`, dann `DENY`, dann `ALLOW`. Ein `DENY` lässt sich durch kein `ALLOW` aushebeln.

Default-Deny erreicht man mit einer ALLOW-Policy ohne Regeln, die nie matcht. Ich lege sie pro Namespace an, nicht meshweit, weil eine meshweite Sperre im Root-Namespace auch Ingress-Gateways und Systemkomponenten trifft:

```yaml
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: allow-nothing
  namespace: team-a
spec: {}
```

Danach werden Zugriffe explizit freigegeben, gebunden an Principals (also SPIFFE-IDs ohne `spiffe://`) oder ganze Namespaces:

```yaml
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: api-allow-callers
  namespace: team-a
spec:
  selector:
    matchLabels:
      app: api
  action: ALLOW
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/team-a/sa/frontend"]
    to:
    - operation:
        ports: ["8080"]
  - from:
    - source:
        namespaces: ["istio-ingress"]
```

Diese Policy enthält nur L4-Attribute und funktioniert deshalb in beiden Modi. Die Felder `principals`, `namespaces`, `ipBlocks` und `ports` kann ztunnel durchsetzen. Seit Istio 1.31 gibt es zusätzlich `trustDomains` in der Source, was bei mehreren Trust Domains (etwa nach einer CA-Migration) hilft.

Ein wichtiger Fallstrick im Ambient-Modus: Enthält eine Policy, die ztunnel durchsetzen soll, L7-Attribute wie `methods` oder `paths`, wird sie zur Sicherheit zu einer `DENY`-Policy. L7-Regeln gehören an den Waypoint und werden per `targetRefs` an den Service gebunden:

```yaml
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: api-read-only
  namespace: team-a
spec:
  targetRefs:
  - kind: Service
    group: ""
    name: api
  action: ALLOW
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/team-a/sa/frontend"]
    to:
    - operation:
        methods: ["GET"]
        paths: ["/v1/*"]
```

Läuft der Verkehr über einen Waypoint, sieht der ztunnel am Ziel die Identität des Waypoints, nicht die des ursprünglichen Clients. Bei Default-Deny muss die L4-Policy am Ziel-Workload deshalb den ServiceAccount des Waypoints erlauben. Wer das vergisst, sucht lange nach dem Grund für `connection reset`.

## Eigene Root-CA und externe PKI

Ohne weitere Konfiguration erzeugt istiod eine selbstsignierte Root-CA und speichert den Schlüssel als Secret im Cluster. Für Labore reicht das. In regulierten Umgebungen gibt es meist Vorgaben, wo CA-Schlüssel liegen dürfen, wer sie rotiert und wie Ausstellungen protokolliert werden.

Es gibt zwei gängige Wege.

Der einfachere ist ein Intermediate aus der Unternehmens-PKI, das als Secret `cacerts` in `istio-system` eingespielt wird, mit den Dateien `ca-cert.pem`, `ca-key.pem`, `root-cert.pem` und `cert-chain.pem`. Damit hängen mehrere Cluster an einer gemeinsamen Root, was Multicluster-Vertrauen ermöglicht. Der Intermediate-Schlüssel liegt aber weiterhin im Cluster.

Der sauberere Weg ist cert-manager mit istio-csr. istio-csr ersetzt die CA-Funktion von istiod, nimmt die CSRs der Workloads entgegen und lässt sie über einen cert-manager-Issuer signieren, zum Beispiel über die Vault-PKI. Der Signaturschlüssel bleibt in Vault. In regulierten Umgebungen ist genau dieser Punkt oft das entscheidende Argument gegenüber der IT-Sicherheit.

Die Vault-Rolle muss URI-SANs im SPIFFE-Format erlauben. Ein Ausgangspunkt, der an die eigenen Richtlinien anzupassen ist:

```bash
vault write pki_int/roles/istio-workloads \
  allowed_uri_sans="spiffe://cluster.local/*" \
  allowed_domains="istio-system.svc" \
  allow_subdomains=true \
  require_cn=false \
  max_ttl=48h
```

Der Issuer in cert-manager, den istio-csr standardmäßig unter dem Namen `istio-ca` in `istio-system` erwartet:

```yaml
apiVersion: cert-manager.io/v1
kind: Issuer
metadata:
  name: istio-ca
  namespace: istio-system
spec:
  vault:
    server: https://vault.example.com
    path: pki_int/sign/istio-workloads
    auth:
      kubernetes:
        role: istio-csr
        mountPath: /v1/auth/kubernetes
        serviceAccountRef:
          name: vault-issuer
```

Auf Istio-Seite wird die eingebaute CA abgeschaltet und auf istio-csr verwiesen (Helm-Values für istiod):

```yaml
global:
  caAddress: cert-manager-istio-csr.cert-manager.svc:443
pilot:
  env:
    ENABLE_CA_SERVER: "false"
```

Die Referenzkonfiguration von cert-manager mountet zusätzlich das Serving-Zertifikat von istiod, sie sollte als Basis dienen. Drei Punkte aus der istio-csr-Doku sind verbindlich: Die Root-CA wird statisch eingebunden (`app.tls.rootCAFile`), statt sie automatisch zu ermitteln. ACME-Issuer funktionieren nicht, weil öffentliche CAs keine SPIFFE-SANs signieren. Und istio-csr muss vor Istio installiert werden, ein nachträglicher Einbau in einen laufenden Mesh wird nicht unterstützt. Für Ambient braucht es istio-csr ab v0.12.0 und den Value `app.server.caTrustedNodeAccounts=istio-system/ztunnel`, damit ztunnel Zertifikate im Namen der Workloads auf seinem Knoten anfordern darf.

Wer einen bestehenden Mesh auf eine neue CA umzieht, braucht eine Übergangsphase, in der beide Roots im Trust Bundle stehen. Das ist ein eigenes Projekt und sollte in einem Testcluster geprobt werden.

## Ausnahmen: Health-Checks, Nicht-Mesh-Workloads, Egress

Health-Checks sind in beiden Modi gelöst. Im Sidecar-Modus schreibt Istio HTTP-, TCP- und gRPC-Probes standardmäßig auf den Agent um. Im Ambient-Modus markiert istio-cni Kubelet-Verkehr per SNAT mit `169.254.7.127`, ztunnel nimmt ihn von der Policy aus. Wer NetworkPolicies einsetzt, muss diese Adresse (und das IPv6-Pendant) freigeben.

Für einzelne Ports, die Klartext annehmen müssen, etwa ein Metrics-Endpunkt für einen externen Scraper, gibt es im Sidecar-Modus `portLevelMtls`. Es greift nur zusammen mit einem Selector und bezieht sich auf den Container-Port:

```yaml
apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata:
  name: legacy-metrics
  namespace: team-a
spec:
  selector:
    matchLabels:
      app: legacy-exporter
  mtls:
    mode: STRICT
  portLevelMtls:
    9100:
      mode: PERMISSIVE
```

Im Ambient-Modus sollte man das Verhalten port-spezifischer Ausnahmen für die eingesetzte Version vorab testen. Jede Ausnahme gehört mit Begründung und Verantwortlichem ins Git-Repository.

Ausgehender Verkehr ist der Teil, den Teams am häufigsten unterschätzen. Mit `outboundTrafficPolicy.mode: REGISTRY_ONLY` in der MeshConfig erreichen Workloads nur noch Ziele, die als Service oder ServiceEntry registriert sind. Ein Egress-Gateway bündelt den Verkehr und gibt eine feste Identität für Firewall-Regeln. Beides ist aber keine harte Grenze: Ein Pod, der die Umleitung umgeht, kommt trotzdem nach außen. Durchgesetzt wird Egress erst mit NetworkPolicies bzw. der Firewall, die nur das Gateway nach außen lassen.

## Verifikation und Debugging

Für den Sidecar-Modus sind diese Kommandos der Ausgangspunkt:

```bash
istioctl analyze -A
istioctl x describe pod <pod> -n team-a
istioctl proxy-config secret deploy/api -n team-a
```

`describe` zeigt, welche PeerAuthentication und welche Policies auf den Pod wirken. `proxy-config secret` zeigt das aktuelle Workload-Zertifikat samt Gültigkeit.

Im Ambient-Modus fragt man ztunnel direkt:

```bash
istioctl ztunnel-config workloads
istioctl ztunnel-config certificates "$ZTUNNEL".istio-system
kubectl -n istio-system logs -l app=ztunnel | grep -E "inbound|outbound"
```

Die Spalte `PROTOCOL` muss für Mesh-Workloads `HBONE` zeigen. Steht dort `TCP`, ist der Workload nicht im Mesh und spricht Klartext.

Für Policies lohnt sich ein Stufenplan: erst `ALLOW`-Regeln ausrollen und anhand von Access-Logs prüfen, dann die `allow-nothing`-Policy setzen. Abgelehnte Requests erscheinen im Sidecar-Modus als HTTP 403 mit `RBAC: access denied`, auf L4 als zurückgesetzte Verbindung.

## Performance und Betrieb

mTLS selbst ist auf moderner Hardware kein relevanter Kostenfaktor, der Proxy drumherum schon. Im Sidecar-Modus skaliert der Ressourcenbedarf mit der Anzahl der Pods, und Requests und Limits der Sidecars sollten bewusst gesetzt werden, statt den Defaults zu vertrauen. Im Ambient-Modus fällt ein ztunnel pro Knoten an, Waypoints nur dort, wo L7 gebraucht wird. Konkrete Zahlen hängen stark vom Verkehrsprofil ab und sollten mit eigener Last gemessen werden.

Für den Betrieb gehören drei Dinge ins Monitoring: das Ablaufdatum der Root- und Intermediate-Zertifikate (die selbstsignierte Istio-Root läuft standardmäßig zehn Jahre, eine Unternehmens-Intermediate oft deutlich kürzer), der Anteil von Verbindungen mit `connection_security_policy="none"` und die Fehlerquote bei der Zertifikatsausstellung in istiod bzw. istio-csr. Fällt die CA aus, laufen bestehende Workloads weiter, bis ihre Zertifikate ablaufen. Neue Pods starten dagegen sofort nicht mehr sauber.

Wer FIPS-Vorgaben hat: Istio 1.31 bringt einen FIPS-140-3-Modus, der TLS 1.2 oder höher mit konformen Cipher Suites erzwingt.

## Upgrades mit Revisionen

Im Sidecar-Modus ist das revisionsbasierte Canary-Upgrade der Standard. Die neue Control Plane läuft parallel, Namespaces hängen an Revision Tags statt an konkreten Versionen:

```bash
istioctl install --set revision=1-31-1
istioctl tag set prod-canary --revision 1-31-1
kubectl label namespace team-a istio-injection- istio.io/rev=prod-canary --overwrite
kubectl rollout restart deployment -n team-a

# nach erfolgreicher Validierung
istioctl tag set prod-stable --revision 1-31-1 --overwrite
istioctl uninstall --revision 1-30-1 -y
```

Im Ambient-Modus ist die Lage anders. istiod lässt sich per Revision parallel betreiben, istio-cni unterstützt laut Doku aber keine Canary-Upgrades. ztunnel und CNI einer Version 1.x sind mit Control Planes 1.x und 1.x+1 kompatibel, also kommt immer zuerst die Control Plane. Ein In-Place-Upgrade von ztunnel unterbricht kurz den gesamten Ambient-Verkehr auf dem Knoten, besonders lang laufende TCP-Verbindungen. Für Produktion heißt das: Knoten vorher cordonen und leeren oder Node Pools blue/green tauschen. Waypoints und Gateways folgen über Revision Tags, seit 1.31 auch mit gewichteten Canaries.

## Einordnung

mTLS mit Istio lohnt sich, sobald mehrere Teams Workloads im selben Cluster betreiben oder Auflagen wie BSI-Grundschutz, KRITIS oder interne Sicherheitsrichtlinien eine Verschlüsselung und Authentifizierung im Cluster verlangen. Für einen einzelnen Monolithen mit Datenbank ist ein Service Mesh zu viel Infrastruktur, dort reichen TLS in der Anwendung und NetworkPolicies.

Meine Empfehlung für den Einstieg: Ambient-Modus, PeerAuthentication `STRICT` namespaceweise nach Messung, Default-Deny pro Namespace und eigene ServiceAccounts pro Anwendung. Waypoints erst dort, wo L7-Policies wirklich gebraucht werden. In regulierten Umgebungen von Anfang an istio-csr mit externer PKI einplanen, weil ein späterer Wechsel der CA aufwendig ist. Policies, Ausnahmen und Revision Tags gehören ins Git und werden per GitOps ausgerollt, wie in [ArgoCD Multi-Cluster GitOps](/blog/argocd-multi-cluster-gitops/) beschrieben. Für abgeschottete Netze kommen zusätzliche Anforderungen an Registry und Images hinzu, siehe [Kubernetes Air-Gapped](/blog/kubernetes-air-gapped/).

Wer Unterstützung bei Einführung oder Migration eines Service Mesh sucht, findet meine Schwerpunkte unter [Leistungen](/#leistungen) und den Weg zu mir über [Kontakt](/#kontakt).
