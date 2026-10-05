---
title: "Terraform oder Crossplane: Leitfaden für Plattformteams"
description: "Terraform, OpenTofu oder Crossplane: Vergleich von State, Drift, Self-Service, GitOps und Lizenz, mit Entscheidungsmatrix und Codebeispielen für 2026."
pubDate: 2026-10-06
tags: ["Terraform", "OpenTofu", "Crossplane", "Infrastructure as Code", "Platform Engineering"]
summary: "Terraform und OpenTofu arbeiten mit einem expliziten Plan/Apply-Workflow und eignen sich am besten für Grundinfrastruktur, die selten und kontrolliert geändert wird. Crossplane gleicht den Zustand kontinuierlich über Kubernetes-Controller ab und ist die stärkere Wahl, wenn Fachteams Infrastruktur per Self-Service über eigene Plattform-APIs anfordern sollen. In vielen Organisationen ist die Kombination beider sinnvoll: Terraform oder OpenTofu für das Bootstrapping, Crossplane für die Self-Service-Schicht."
faq:
  - q: "Was ist der Hauptunterschied zwischen Terraform und Crossplane?"
    a: "Terraform und OpenTofu ändern Infrastruktur nur, wenn jemand einen Plan erzeugt und anwendet. Crossplane läuft als Controller in einem Kubernetes-Cluster und gleicht den gewünschten Zustand dauerhaft mit der Realität ab. Damit korrigiert Crossplane Drift automatisch, während Terraform Drift erst beim nächsten Plan sichtbar macht."
  - q: "Ist Terraform noch Open Source?"
    a: "Nein, im Sinne der OSI-Definition nicht. HashiCorp hat Terraform im August 2023 von der MPL 2.0 auf die Business Source License 1.1 umgestellt, die kommerzielle Nutzung erlaubt, aber konkurrierende Angebote ausschließt. Provider und SDKs blieben unter MPL 2.0. Der Open-Source-Fork OpenTofu steht unter MPL 2.0 und ist seit April 2025 ein CNCF-Sandbox-Projekt."
  - q: "Kann man Terraform-Module in Crossplane weiterverwenden?"
    a: "Ja, über provider-terraform bzw. provider-opentofu von Upbound. Beide stellen eine Workspace-Ressource bereit, die HCL-Code aus Git oder inline ausführt und regelmäßig abgleicht. Das eignet sich als Brücke bei der Migration, bringt aber den Terraform-State in den Cluster und verliert die Granularität nativer Managed Resources."
  - q: "Brauchen Managed Resources in Crossplane v2 einen Namespace?"
    a: "In Crossplane v2 sind Managed Resources standardmäßig namespaced und nutzen API-Gruppen mit dem Suffix .m, etwa s3.aws.m.upbound.io. Die bisherigen cluster-scoped Ressourcen funktionieren mit Providern der v2-Generation weiter, gelten aber als Legacy. Neue Setups sollten direkt auf namespaced Ressourcen aufbauen."
sources:
  - title: "HashiCorp adopts Business Source License"
    url: "https://www.hashicorp.com/en/blog/hashicorp-adopts-business-source-license"
  - title: "IBM Completes Acquisition of HashiCorp"
    url: "https://newsroom.ibm.com/2025-02-27-ibm-completes-acquisition-of-hashicorp,-creates-comprehensive,-end-to-end-hybrid-cloud-platform"
  - title: "OpenTofu Releases (GitHub)"
    url: "https://github.com/opentofu/opentofu/releases"
  - title: "OpenTofu: CNCF Project Page"
    url: "https://www.cncf.io/projects/opentofu/"
  - title: "Crossplane Docs: What's new in v2"
    url: "https://docs.crossplane.io/latest/whats-new/"
  - title: "Crossplane Docs: Managed Resources"
    url: "https://docs.crossplane.io/latest/managed-resources/managed-resources/"
---

Plattformteams stehen beim Thema Infrastructure as Code inzwischen selten vor der Frage, ob sie es einsetzen, sondern mit welchem Modell. Terraform (bzw. der Fork OpenTofu) und Crossplane lösen dasselbe Problem auf grundverschiedene Weise. Wer das ignoriert, baut entweder ein Self-Service-Portal auf einem Werkzeug, das dafür nicht gemacht ist, oder verlagert Netzwerk und IAM-Grundlagen in einen Kubernetes-Controller, den beim ersten Cluster-Ausfall niemand mehr erreicht.

Dieser Leitfaden richtet sich an Plattform-Leads, Architekt:innen und SRE-Teams, die eine begründete Entscheidung treffen oder eine bestehende überprüfen wollen. Alle Versionsangaben beziehen sich auf den Stand Oktober 2026: Terraform 1.16.5, OpenTofu 1.13.1, Crossplane 2.4.2.

## Zwei Arbeitsmodelle

### Terraform und OpenTofu: Plan, Review, Apply

Terraform ist ein CLI-Werkzeug. Es liest HCL-Code, vergleicht ihn mit dem gespeicherten State und der realen Infrastruktur, erzeugt einen Plan und führt ihn nach Freigabe aus. Danach passiert nichts mehr, bis der nächste Lauf startet. Dieses Modell hat einen großen Vorteil: Jede Änderung ist vorher als Diff sichtbar. Für Netzwerk-Topologien, Landing Zones oder Datenbank-Cluster, bei denen ein falsches `replace` teuer ist, ist das genau die Kontrolle, die man will.

OpenTofu verhält sich im Kern identisch, hat aber eigene Features ergänzt, etwa clientseitige State-Verschlüsselung (seit 1.7) und in 1.12 einen dynamisch auswertbaren `prevent_destroy` sowie das Lifecycle-Argument `destroy = false`, mit dem Ressourcen aus dem State entfernt werden, ohne sie zu löschen. Terraform 1.17 befindet sich im Beta-Stadium, unter anderem mit Terraform Policy als festem Bestandteil.

### Crossplane: kontinuierliche Reconciliation

Crossplane erweitert die Kubernetes-API. Jede Cloud-Ressource wird zu einem Kubernetes-Objekt (Managed Resource), ein Provider-Controller gleicht sie in einem festen Intervall mit der Realität ab. Es gibt keinen Plan und keinen Apply-Schritt. Wer ein Objekt ändert, löst die Änderung beim nächsten Reconcile aus.

Die eigentliche Stärke liegt eine Ebene höher. Mit Composite Resource Definitions (XRDs) definiert das Plattformteam eigene APIs, etwa `kind: Database` in der Gruppe `platform.example.com`, und hinterlegt in einer Composition, welche Ressourcen daraus entstehen. Fachteams sehen nur die schmale API, nicht die 40 Felder einer RDS-Instanz. Wie man solche APIs schneidet, beschreibe ich ausführlich in [Crossplane als Plattform-API](/blog/crossplane-plattform-apis/).

Crossplane v2 hat dieses Modell deutlich verändert. Composite Resources und Managed Resources sind jetzt standardmäßig namespaced, XRDs nutzen `apiextensions.crossplane.io/v2` mit einem `scope`-Feld, Claims entfallen für die neuen XRs, und Compositions laufen nur noch im Pipeline-Modus mit Functions. Die klassische Patch-and-Transform-Syntax direkt in der Composition wurde entfernt. Seit November 2025 ist Crossplane ein Graduated-Projekt der CNCF.

## Dieselbe Ressource in beiden Welten

Ein versionierter S3-Bucket für `team-a`, zuerst in HCL. Der Code läuft unverändert mit Terraform und OpenTofu.

```hcl
terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = "eu-central-1"
}

resource "aws_s3_bucket" "artifacts" {
  bucket = "team-a-artifacts-example"

  tags = {
    team         = "team-a"
    "managed-by" = "terraform"
  }
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}
```

Dasselbe als namespaced Managed Resources in Crossplane v2 mit dem Upbound-Provider `provider-aws-s3`. Wichtig sind das `.m.` in der API-Gruppe und das Pflichtfeld `kind` in `providerConfigRef`. Fehlt die Referenz, verwendet Crossplane `ClusterProviderConfig` mit dem Namen `default`.

```yaml
apiVersion: s3.aws.m.upbound.io/v1beta1
kind: Bucket
metadata:
  name: team-a-artifacts-example
  namespace: team-a
spec:
  forProvider:
    region: eu-central-1
    tags:
      team: team-a
      managed-by: crossplane
  providerConfigRef:
    kind: ProviderConfig
    name: aws-team-a
---
apiVersion: s3.aws.m.upbound.io/v1beta1
kind: BucketVersioning
metadata:
  name: team-a-artifacts-versioning
  namespace: team-a
spec:
  forProvider:
    region: eu-central-1
    bucketRef:
      name: team-a-artifacts-example
    versioningConfiguration:
      status: Enabled
  providerConfigRef:
    kind: ProviderConfig
    name: aws-team-a
```

Ohne Annotation `crossplane.io/external-name` verwendet der Provider `metadata.name` als Bucket-Namen. Da S3-Namen global eindeutig sind, gehört eine Namenskonvention in die Composition, nicht in die Hände der Fachteams. In der Praxis würde ein Team ohnehin nicht diese beiden Objekte anlegen, sondern ein eigenes XR wie `kind: ObjectStore`, aus dem die Composition Bucket, Versioning, Verschlüsselung und Policy erzeugt.

Der Namespace ist mehr als Kosmetik. Mit v2 lässt sich per Kubernetes-RBAC regeln, dass `team-a` nur Objekte im eigenen Namespace sieht und nur die `ProviderConfig` dieses Namespace mit den passenden Credentials nutzen kann. Unter v1 waren Managed Resources cluster-scoped, und diese Trennung musste über Claims und zusätzliche Policies nachgebaut werden.

## Die Kriterien im Detail

### State-Handling

Terraform speichert den State in einer Datei im Backend (S3, Azure Blob, GCS, HCP Terraform, Postgres u. a.). Dieser State enthält oft Secrets im Klartext, braucht Locking und muss bei Refactorings mit `moved`- oder `removed`-Blöcken gepflegt werden. Große monolithische States werden langsam und riskant, deshalb schneidet man sie nach Verantwortlichkeit. OpenTofu kann den State clientseitig verschlüsseln, Terraform verlässt sich auf die Verschlüsselung des Backends.

Crossplane hat keinen separaten State. Der gewünschte Zustand liegt in etcd, der beobachtete Zustand im `status` der Objekte, Secrets landen über `writeConnectionSecretToRef` in Kubernetes-Secrets. Das verschiebt die Verantwortung: Statt State-Buckets sichert man etcd bzw. die Git-Quelle und muss etcd-Verschlüsselung aktiv haben.

### Drift-Erkennung

Terraform erkennt Drift nur bei einem Lauf, etwa mit `terraform plan -refresh-only` in einem geplanten Pipeline-Job. HCP Terraform bietet je nach Tarif Health Assessments mit automatischer Drift-Erkennung. Korrigiert wird erst, wenn jemand den Plan anwendet.

Crossplane korrigiert Drift selbstständig im nächsten Poll-Intervall, das sich pro Provider und per Annotation `crossplane.io/poll-interval` pro Ressource steuern lässt. Das ist gewollt, kann aber überraschen: Wer in einer Störung manuell eine Security Group öffnet, sieht die Änderung nach wenigen Minuten verschwinden. Über `managementPolicies` (z. B. nur `Observe`) lässt sich das für einzelne Ressourcen abschwächen.

### Self-Service für Fachteams

Hier liegt der klarste Unterschied. Mit Terraform baut man Self-Service über Module plus einen Workflow-Layer davor: Pull Requests auf ein Repository, ein Portal oder HCP Terraform mit No-Code-Modulen. Das funktioniert, aber jedes Team bekommt faktisch Zugriff auf ein Werkzeug mit voller Cloud-Mächtigkeit, und Leitplanken entstehen über Policies im Nachhinein.

Crossplane liefert die API selbst. Ein Fachteam legt ein YAML-Objekt in seinem Namespace an und bekommt Status und Fehler über `kubectl` oder ArgoCD zurück. Validierung geschieht über das OpenAPI-Schema der XRD, ergänzend über Admission-Policies wie Kyverno oder Validating Admission Policies. Genau das ist häufig der Grund für Crossplane: Fachteams bekommen zum Beispiel Buckets, Datenbanken oder ML-Werkzeuge über eigene Plattform-APIs, ohne Cloud- oder Infrastruktur-Credentials zu sehen.

### GitOps-Integration

Crossplane-Objekte sind normale Kubernetes-Ressourcen. ArgoCD oder Flux synchronisieren sie wie jedes andere Manifest, Health-Checks lassen sich über die Conditions `Ready` und `Synced` abbilden. Das Zusammenspiel beschreibe ich in [ArgoCD Multi-Cluster-GitOps](/blog/argocd-multi-cluster-gitops/).

Terraform passt schlechter in ein Pull-basiertes GitOps-Modell, weil der Apply ein imperativer Schritt ist. Üblich sind Pipeline-basierte Workflows (Atlantis, HCP Terraform, GitHub Actions) oder Operatoren wie der Flux-Terraform-Controller, die das Modell nachbilden. Das Review des Plans im Pull Request ist dabei sogar ein Vorteil, den Crossplane nicht bietet: Dort sieht man im PR nur das geänderte YAML, nicht die Auswirkung.

### Ökosystem und Provider

Die Terraform-Registry ist das größte IaC-Ökosystem überhaupt, inklusive Nischenanbietern wie DNS-Hostern, SaaS-Tools und On-Prem-Systemen. OpenTofu nutzt dieselben Provider über die eigene Registry. Der AWS-Provider allein liegt aktuell bei Version 6.67.

Crossplane-Provider für die großen Clouds werden mit Upjet aus den Terraform-Providern generiert und haben daher eine ähnliche Abdeckung. Für kleinere Systeme fehlen oft Provider, oder sie sind kaum gepflegt. Ein Punkt, der in Entscheidungen häufig übersehen wird: Seit März 2025 sind bei den offiziellen Upbound-Providern nur noch die jeweils neuesten Versionen frei abrufbar, ältere Versionen erfordern ein Upbound-Abonnement. Wer Provider-Versionen lange pinnen will, muss das einplanen oder selbst aus dem Quellcode bauen und in eine eigene Registry spiegeln. In Air-gapped-Umgebungen ist das ohnehin Pflicht, siehe [Kubernetes air-gapped betreiben](/blog/kubernetes-air-gapped/).

### Lernkurve und Betrieb

Terraform ist für Infrastruktur-Engineers schnell erlernbar, das Fehlerbild ist lokal nachvollziehbar. Der Betrieb beschränkt sich auf Backends, Pipelines und Credentials.

Crossplane setzt solides Kubernetes-Wissen voraus. Fehler zeigen sich als Conditions und Events verteilt über XR, Composition-Functions und Managed Resources, `crossplane beta trace` hilft dabei. Der Betrieb umfasst Upgrades von Crossplane, Providern und Functions, Ressourcenverbrauch der Provider-Pods (große Provider registrieren Hunderte CRDs, deshalb die Aufteilung in Provider-Familien) und Monitoring über die Prometheus-Metriken der Controller. Vor einem Upgrade von v1 auf v2 prüft `crossplane beta upgrade check`, ob entfernte Features wie native Patch-and-Transform oder `ControllerConfig` noch im Einsatz sind.

## Lizenzlage und Herstellerabhängigkeit

HashiCorp hat am 10. August 2023 angekündigt, alle künftigen Releases seiner Produkte unter der Business Source License 1.1 zu veröffentlichen. Für Endanwender bleibt die Nutzung erlaubt, ausgeschlossen sind Angebote, die mit HashiCorp konkurrieren. APIs, SDKs und fast alle Bibliotheken, darunter die Provider, blieben unter MPL 2.0. Die Community antwortete mit OpenTofu, das seit September 2023 unter dem Dach der Linux Foundation entwickelt wird und im April 2025 als Sandbox-Projekt in die CNCF aufgenommen wurde, mit einer Ausnahme für die MPL-2.0-Lizenz.

Am 27. Februar 2025 hat IBM die Übernahme von HashiCorp abgeschlossen. An der BUSL hat sich seitdem nichts geändert. Spürbar ist die kommerzielle Seite: Der alte kostenlose Tarif von HCP Terraform wurde zum 31. März 2026 eingestellt und durch einen nutzungsbasierten Free-Tarif mit Ressourcengrenze ersetzt.

Für die meisten Unternehmen und Behörden ist die BUSL rechtlich unproblematisch, solange sie kein eigenes IaC-Produkt anbieten. Relevant wird sie bei Dienstleistern, die Plattformen für Dritte betreiben, und bei Beschaffungsvorgaben, die OSI-konforme Lizenzen verlangen. Crossplane steht unter Apache 2.0 und ist als CNCF-Projekt herstellerneutral, die offiziellen Provider-Pakete unterliegen allerdings der oben beschriebenen Bezugspolitik von Upbound.

## Entscheidungsmatrix

| Kriterium | Terraform | OpenTofu | Crossplane v2 |
|---|---|---|---|
| Arbeitsmodell | Plan/Apply, ereignisgesteuert | Plan/Apply, ereignisgesteuert | Kontinuierliche Reconciliation |
| Vorschau von Änderungen | Ja, Plan als Diff | Ja, Plan als Diff | Nein, nur Diff des YAML |
| State | Datei im Backend | Datei im Backend, optional verschlüsselt | Kubernetes-Objekte in etcd |
| Drift | Erkennen per Plan, manuell korrigieren | Erkennen per Plan, manuell korrigieren | Automatisch korrigiert |
| Self-Service-APIs | Über Module plus Portal/Workflow | Über Module plus Portal/Workflow | Nativ über XRDs und Namespaces |
| GitOps (Pull-Modell) | Nur über Zusatzwerkzeuge | Nur über Zusatzwerkzeuge | Nativ mit ArgoCD/Flux |
| Provider-Ökosystem | Sehr groß | Sehr groß (gleiche Provider) | Groß für Hyperscaler, lückenhaft in Nischen |
| Voraussetzung | CLI, Backend, Pipeline | CLI, Backend, Pipeline | Betriebener Kubernetes-Cluster |
| Lizenz | BUSL 1.1 | MPL 2.0 | Apache 2.0 |
| Bootstrapping ohne Cluster | Ja | Ja | Nein |

## Kombination beider Ansätze

Das Henne-Ei-Problem ist der stärkste Grund für eine Kombination: Crossplane braucht einen Cluster, Netzwerk und Identitäten, bevor es irgendetwas verwalten kann. Diese Grundinfrastruktur mit Terraform oder OpenTofu zu bauen, ist naheliegend. Sie ändert sich selten, profitiert vom Plan-Review und muss auch dann reparierbar sein, wenn der Management-Cluster nicht läuft.

Ein Schnitt, der sich bewährt: Terraform oder OpenTofu verwalten Accounts bzw. Subscriptions, Netzwerk, zentrales IAM und den Management-Cluster inklusive Crossplane-Installation. Crossplane übernimmt alles, was Fachteams anfordern, also Datenbanken, Buckets, Queues, DNS-Einträge und Workload-Identitäten. Die Grenze sollte an der Frage verlaufen, wer die Ressource besitzt, nicht an der Ressourcenart.

Bestehende Terraform-Module lassen sich mit `provider-terraform` oder `provider-opentofu` von Upbound weiterverwenden. Beide bieten eine `Workspace`-Ressource, die HCL aus Git oder inline ausführt, inzwischen ebenfalls namespaced (z. B. `tf.m.upbound.io`). Das ist eine brauchbare Brücke, aber kein Zielbild: Der Workspace ist aus Sicht von Crossplane eine Blackbox, Drift wird nur auf Workspace-Ebene sichtbar, und der Terraform-State wandert in den Cluster. Ich würde es nutzen, um ein Modul ohne nativen Crossplane-Provider einzubinden oder um eine Migration schrittweise durchzuführen.

Zwei Fallstricke treten bei Kombinationen regelmäßig auf. Erstens doppelte Verantwortung: Wenn Terraform und Crossplane dieselbe Ressource verwalten, überschreiben sie sich gegenseitig. Für Übernahmen eignet sich in Crossplane die `managementPolicies`-Einstellung `Observe` mit gesetzter External-Name-Annotation, in Terraform ein `removed`-Block. Zweitens Credentials: Die ProviderConfigs von Crossplane brauchen Cloud-Identitäten, die man sinnvollerweise per Terraform anlegt und per Workload Identity statt statischer Keys anbindet.

## Einordnung

Terraform oder OpenTofu genügen, wenn ein zentrales Team die Infrastruktur verwaltet, Änderungen selten sind und kein Kubernetes-Know-how im Haus ist. Zwischen beiden entscheidet vor allem die Lizenz- und Beschaffungslage. Wer HCP Terraform oder Terraform Enterprise nutzt, bleibt bei Terraform. Wer Wert auf eine OSI-Lizenz und herstellerneutrale Governance legt, wählt OpenTofu; der Wechsel ist bei aktuellen Versionen meist ohne Codeänderung möglich, sollte aber gegen die jeweils genutzten Features geprüft werden.

Crossplane lohnt sich, wenn eine Plattform mehrere Fachteams per Self-Service versorgen soll, bereits GitOps mit ArgoCD oder Flux betrieben wird und das Team Kubernetes-Controller sicher betreiben kann. Ohne diese Voraussetzungen ist der Aufwand höher als der Nutzen.

Meine Empfehlung für mittlere und große Organisationen: Grundinfrastruktur und Bootstrapping mit OpenTofu oder Terraform, Self-Service-APIs mit Crossplane v2 auf namespaced Managed Resources. Wer beides sauber trennt, bekommt Plan-Review dort, wo Fehler teuer sind, und Reconciliation dort, wo Fachteams schnell sein wollen. Bei der Bewertung einer konkreten Ausgangslage unterstütze ich gern, Details unter [Leistungen](/#leistungen) oder direkt über [Kontakt](/#kontakt).
