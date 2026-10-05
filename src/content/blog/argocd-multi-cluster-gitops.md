---
title: "Argo CD Multi-Cluster-GitOps: Architektur für viele Cluster"
description: "Argo CD für viele Cluster und Teams: Topologien, ApplicationSets, AppProjects, Promotion, Secrets, Sharding und Sicherheit, mit YAML für Argo CD 3.5."
pubDate: 2026-10-06
tags: ["Argo CD", "GitOps", "Multi-Cluster", "Kubernetes", "Platform Engineering"]
summary: "Für Multi-Cluster-GitOps mit Argo CD ist meist ein zentrales Argo CD pro Sicherheitszone die beste Wahl, kombiniert mit ApplicationSets über Cluster-Labels und je einem AppProject pro Fachteam. Agent-basierte Hub-and-Spoke-Modelle wie argocd-agent lösen Netz- und Skalierungsprobleme, sind aber Stand Oktober 2026 noch in Version 0.x. Die meisten Probleme im Betrieb entstehen nicht durch Argo CD selbst, sondern durch unklare Repo-Struktur, zu weit gefasste Cluster-Credentials und unkontrollierten App-of-Apps-Wildwuchs."
faq:
  - q: "Sollte man ein zentrales Argo CD oder eine Instanz pro Cluster betreiben?"
    a: "Ein zentrales Argo CD pro Sicherheitszone oder Netzsegment ist für die meisten Organisationen der beste Kompromiss: eine Oberfläche, ein RBAC-Modell, eine Stelle für ApplicationSets. Eine Instanz pro Cluster lohnt sich, wenn Cluster netztechnisch strikt getrennt sind oder unabhängig vom Management-Cluster weiterarbeiten müssen. Der Preis sind mehr Instanzen, die man upgraden und überwachen muss."
  - q: "Was ist der Argo CD Agent und ist er produktionsreif?"
    a: "argocd-agent ist ein Projekt unter argoproj-labs, bei dem Application Controller und Repo-Server auf den Workload-Clustern laufen und ein Agent eine ausgehende gRPC-Verbindung zum zentralen Principal aufbaut. Dadurch braucht die Zentrale keinen Netzzugriff auf die Kubernetes-APIs der Workload-Cluster. Stand Oktober 2026 ist v0.10.0 aktuell; das Projekt ist aktiv, aber noch nicht als stabil gekennzeichnet, ein Einsatz in Produktion sollte entsprechend abgesichert sein."
  - q: "Wie bekommen Fachteams Self-Service in Argo CD, ohne Admin-Rechte zu erhalten?"
    a: "Jedes Team erhält ein eigenes AppProject, das erlaubte Quell-Repositories, Ziel-Cluster und Namespaces festlegt und cluster-weite Ressourcen sperrt. Die ApplicationSets mit fest eingetragenem project-Feld verwaltet das Plattformteam, die Teams pflegen nur Konfigurationsdateien in ihrem Repository. Mit Service Account Impersonation (Beta seit Argo CD 3.5) synchronisiert Argo CD zusätzlich mit den Rechten eines Service Accounts im Ziel-Namespace statt mit eigenen Admin-Rechten."
  - q: "Wie skaliert Argo CD auf viele Cluster und tausende Applications?"
    a: "Der Application Controller lässt sich als StatefulSet mit mehreren Replicas betreiben, die Cluster werden auf Shards verteilt. Neben dem Standardalgorithmus legacy gibt es round-robin und consistent-hashing, beide laut Feature-Maturity-Seite noch Alpha. Zusätzlich helfen höhere Status- und Operation-Processor-Werte, ein begrenztes Parallelism-Limit am Repo-Server und Git-Webhooks statt Polling."
  - q: "Wie verwaltet man Secrets in einem Multi-Cluster-GitOps-Setup mit Argo CD?"
    a: "Die Argo-CD-Dokumentation empfiehlt ausdrücklich, Secrets im Ziel-Cluster durch einen Operator zu erzeugen, statt sie bei der Manifest-Generierung einzuspielen. In der Praxis heißt das meist External Secrets Operator mit Vault als Backend, wobei in Git nur die ExternalSecret-Referenz liegt. Sealed Secrets funktioniert ebenfalls, erfordert aber pro Cluster ein eigenes Schlüsselpaar und eine saubere Sicherung des Controller-Schlüssels."
sources:
  - title: "Argo CD Releases (GitHub)"
    url: "https://github.com/argoproj/argo-cd/releases"
  - title: "Argo CD: High Availability und Controller-Sharding"
    url: "https://argo-cd.readthedocs.io/en/stable/operator-manual/high_availability/"
  - title: "Argo CD: ApplicationSet Cluster Generator"
    url: "https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Generators-Cluster/"
  - title: "Argo CD: Application Sync using Impersonation"
    url: "https://argo-cd.readthedocs.io/en/stable/operator-manual/app-sync-using-impersonation/"
  - title: "argocd-agent Dokumentation"
    url: "https://argocd-agent.readthedocs.io/latest/"
  - title: "Argo CD: Secret Management"
    url: "https://argo-cd.readthedocs.io/en/stable/operator-manual/secret-management/"
---

Sobald mehr als eine Handvoll Kubernetes-Cluster und mehrere Teams im Spiel sind, wird GitOps mit Argo CD zur Architekturfrage. Zu klären ist, wo Argo CD läuft, wer in welche Cluster deployen darf und wie das Repository geschnitten ist. Vor allem muss die Architektur verhindern, dass ein fehlerhafter Commit zwanzig Cluster gleichzeitig trifft.

Dieser Artikel richtet sich an Plattform-Teams, die Argo CD für viele Cluster und Fachteams aufbauen oder ein gewachsenes Setup aufräumen wollen. Die Beispiele beziehen sich auf Argo CD 3.5 (aktuell v3.5.3, v3.6 ist als Release Candidate verfügbar; Stand: Oktober 2026).

## Topologien: zentral, pro Cluster oder Hub-and-Spoke

### Zentrales Argo CD

Eine Argo-CD-Instanz auf einem Management-Cluster verwaltet alle Workload-Cluster. Die Cluster werden als Secrets mit dem Label `argocd.argoproj.io/secret-type: cluster` registriert, der Application Controller spricht direkt mit deren Kubernetes-APIs.

Der Vorteil ist eine zentrale Oberfläche mit einem RBAC-Modell und einer Stelle für ApplicationSets. Der Nachteil ist ebenso klar: Die Zentrale braucht Netzzugriff auf jede Cluster-API und hält Credentials für alle Cluster. Fällt der Management-Cluster aus, laufen die Workloads weiter, aber es gibt keine Syncs und keine Drift-Korrektur.

### Argo CD pro Cluster

Jeder Cluster bekommt eine eigene Instanz, die nur sich selbst verwaltet. Das ist die einfachste Variante für strikt getrennte Netze und reduziert den Blast Radius auf einen Cluster. Mit wachsender Clusterzahl wird der Overhead spürbar: Upgrades, SSO-Anbindung, RBAC und Monitoring müssen pro Instanz gepflegt werden, und es gibt keinen Gesamtüberblick.

### Hub-and-Spoke mit argocd-agent

Das Projekt [argocd-agent](https://argocd-agent.readthedocs.io/latest/) unter argoproj-labs dreht das Modell um. Application Controller, Repo-Server und Redis laufen auf den Workload-Clustern, ein Agent baut von dort eine ausgehende gRPC-Verbindung zum Principal auf dem Control-Plane-Cluster auf. Dort laufen UI, API und SSO. Die Verbindung ist bidirektional, wird aber ausschließlich vom Agent initiiert.

Es gibt zwei Modi. Im Managed-Modus ist der Control-Plane-Cluster die Quelle der Wahrheit für Applications, im Autonomous-Modus definiert der Workload-Cluster seine Applications selbst und meldet nur Status zurück. Beide lassen sich mischen. Bricht die Verbindung ab, reconcilen die Workload-Cluster lokal weiter.

Stand Oktober 2026 ist v0.10.0 aktuell (August 2026), unter anderem mit SPIFFE/SPIRE-Integration für mTLS. Die Dokumentation beschreibt das Projekt als aktiv entwickelt und noch nicht feature-complete. Ich würde es dort einsetzen, wo die Netzanforderungen ein Pull-Modell erzwingen, und dann mit einem klaren Upgrade-Plan.

### Meine Empfehlung

Für die meisten Organisationen ist ein zentrales Argo CD pro Sicherheitszone der richtige Schnitt: eine Instanz für Entwicklung und Test, eine eigene für Produktion, gegebenenfalls getrennt nach Standort oder Netzsegment. So bleibt die Zahl der Instanzen klein, und Produktions-Credentials liegen nicht im selben System wie die Dev-Cluster.

## Cluster als Daten: Labels statt Listen

Die wichtigste Entscheidung für Skalierung ist, Cluster über Labels zu beschreiben. Das Cluster-Secret trägt Stage, Standort und Fähigkeiten, ApplicationSets wählen darüber aus.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: prod-site-a
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: cluster
    stage: prod
    site: site-a
    gpu: "true"
type: Opaque
stringData:
  name: prod-site-a
  server: https://prod-site-a.k8s.example.com:6443
  config: |
    {
      "bearerToken": "<token>",
      "tlsClientConfig": {
        "caData": "<base64-ca>"
      }
    }
```

Ein neuer Cluster bekommt seine Add-ons dann allein dadurch, dass sein Secret mit den richtigen Labels angelegt wird. Das Secret selbst sollte nicht im Klartext in Git liegen, sondern über External Secrets aus Vault kommen (siehe unten).

## ApplicationSets für Plattform-Add-ons

Für Add-ons wie cert-manager, Ingress-Controller oder Monitoring-Agents ist der Cluster-Generator das passende Werkzeug. Das folgende ApplicationSet rollt cert-manager auf alle Cluster aus und wählt das Kustomize-Overlay anhand des Stage-Labels.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: addon-cert-manager
  namespace: argocd
spec:
  goTemplate: true
  goTemplateOptions: ["missingkey=error"]
  generators:
    - clusters:
        selector:
          matchLabels:
            argocd.argoproj.io/secret-type: cluster
          matchExpressions:
            - key: stage
              operator: In
              values: ["dev", "test", "prod"]
  syncPolicy:
    applicationsSync: create-update
    preserveResourcesOnDeletion: true
  template:
    metadata:
      name: 'cert-manager-{{.nameNormalized}}'
      labels:
        stage: '{{index .metadata.labels "stage"}}'
    spec:
      project: platform
      source:
        repoURL: https://git.example.com/platform/gitops.git
        targetRevision: main
        path: 'addons/cert-manager/overlays/{{index .metadata.labels "stage"}}'
      destination:
        server: '{{.server}}'
        namespace: cert-manager
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
        syncOptions:
          - CreateNamespace=true
          - ServerSideApply=true
```

Zwei Details sind hier bewusst gesetzt. Der Selektor auf `argocd.argoproj.io/secret-type` schließt den lokalen In-Cluster-Eintrag aus, der kein solches Secret hat. Und `applicationsSync: create-update` zusammen mit `preserveResourcesOnDeletion: true` verhindert, dass ein versehentlich entferntes Label oder ein gelöschtes ApplicationSet Applications samt Ressourcen auf allen Clustern abräumt. Wer bewusst löschen will, tut das gezielt.

## Repository-Struktur

Ob Mono-Repo oder Multi-Repo ist weniger eine Glaubensfrage als eine Frage der Zuständigkeit. Bewährt hat sich ein Plattform-Repository, das dem Plattformteam gehört, und je ein Deploy-Repository pro Fachteam.

```text
platform-gitops/
├── bootstrap/          # Root-Application, AppProjects, ApplicationSets
├── clusters/           # ExternalSecrets für Cluster-Secrets
└── addons/
    └── cert-manager/
        ├── base/
        └── overlays/
            ├── dev/
            ├── test/
            └── prod/

team-a-deploy/
└── apps/
    └── orders/
        ├── base/
        └── stages/
            ├── dev/      # config.yaml + kustomization.yaml
            ├── test/
            └── prod/
```

Stages werden als Verzeichnisse modelliert, nicht als Branches. Branch-pro-Stage führt zu Merge-Konflikten, unklaren Diffs und Cherry-Picks, die niemand mehr nachvollziehen kann. Mit Verzeichnissen ist der Unterschied zwischen Test und Produktion ein normaler Diff im selben Commit.

Kustomize eignet sich für eigene Anwendungen mit kleinen Stage-Unterschieden. Helm ist sinnvoll für Third-Party-Charts. Beides lässt sich kombinieren: Ein Chart in einer festen Version, die Values pro Stage im Repo, eingebunden über `sources` mit `ref`. Argo CD 3.5 rendert Helm-Charts mit Helm 4. Laut Upgrade-Notes müssen OCI-Repositories ohne TLS deshalb explizit als Plain-HTTP konfiguriert werden.

## Self-Service für Fachteams

### AppProjects als Leitplanke

Jedes Fachteam bekommt ein AppProject. Es legt fest, aus welchen Repositories das Team deployen darf, in welche Cluster und Namespaces, und welche Ressourcentypen erlaubt sind.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: team-a
  namespace: argocd
spec:
  description: Deployments von Team A
  sourceRepos:
    - https://git.example.com/team-a/*
  destinations:
    - name: 'dev-*'
      namespace: 'team-a-*'
    - name: 'test-*'
      namespace: 'team-a-*'
    - name: 'prod-*'
      namespace: 'team-a-*'
  clusterResourceWhitelist: []
  namespaceResourceBlacklist:
    - group: ''
      kind: ResourceQuota
    - group: ''
      kind: LimitRange
    - group: networking.k8s.io
      kind: NetworkPolicy
  destinationServiceAccounts:
    - server: https://prod-site-a.k8s.example.com:6443
      namespace: 'team-a-*'
      defaultServiceAccount: argocd-deployer
    - server: https://dev-site-a.k8s.example.com:6443
      namespace: 'team-a-*'
      defaultServiceAccount: argocd-deployer
  roles:
    - name: developer
      groups:
        - team-a-devs
      policies:
        - p, proj:team-a:developer, applications, get, team-a/*, allow
        - p, proj:team-a:developer, applications, sync, team-a/*, allow
  syncWindows:
    - kind: deny
      schedule: '0 18 * * 5'
      duration: 62h
      clusters:
        - 'prod-*'
      manualSync: true
      timeZone: Europe/Berlin
      description: Kein automatisches Deployment in Produktion am Wochenende
```

Die leere `clusterResourceWhitelist` verbietet cluster-weite Ressourcen. Namespaces, Quotas und NetworkPolicies legt das Plattformteam an, nicht das Fachteam. Das Sync-Window blockiert automatische Syncs in Produktion übers Wochenende, erlaubt aber manuelle Syncs für Hotfixes.

### Impersonation

`destinationServiceAccounts` greift nur, wenn Impersonation in `argocd-cm` mit `application.sync.impersonation.enabled: "true"` aktiviert ist. Das Feature ist seit Argo CD 3.5 Beta und gilt seitdem nicht nur für Syncs, sondern auch für Löschungen, Logs und Resource Actions. Argo CD agiert dann im Ziel-Namespace mit den Rechten des Service Accounts `argocd-deployer`, den das Plattformteam mit einer namespace-gebundenen Role ausstattet. Damit begrenzt Kubernetes-RBAC zusätzlich zum AppProject, was ein Team anrichten kann.

### ApplicationSets für Teams

Fachteams sollten keine ApplicationSets selbst anlegen. Die Argo-CD-Doku ist da deutlich: ApplicationSets können Applications in beliebigen Projekten erzeugen, deshalb gehört das Anlegen in Admin-Hand, und ein templatiertes `project`-Feld ist ein Sicherheitsrisiko. Das Plattformteam legt pro Team ein ApplicationSet mit Git-Files-Generator an und trägt das Projekt fest ein.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: team-a-apps
  namespace: argocd
spec:
  goTemplate: true
  goTemplateOptions: ["missingkey=error"]
  generators:
    - git:
        repoURL: https://git.example.com/team-a/team-a-deploy.git
        revision: main
        files:
          - path: "apps/*/stages/*/config.yaml"
  template:
    metadata:
      name: 'team-a-{{index .path.segments 1}}-{{.path.basename}}'
      labels:
        team: team-a
        stage: '{{.path.basename}}'
    spec:
      project: team-a
      source:
        repoURL: https://git.example.com/team-a/team-a-deploy.git
        targetRevision: main
        path: '{{.path.path}}'
      destination:
        name: '{{.cluster}}'
        namespace: '{{.namespace}}'
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
```

Die `config.yaml` im Stage-Verzeichnis enthält nur `cluster` und `namespace`. Gibt ein Team dort einen fremden Namespace an, verweigert Argo CD den Sync, weil das Ziel im AppProject nicht erlaubt ist. So entsteht Self-Service, ohne dass das Team Argo-CD-Objekte schreibt. Nach diesem Prinzip habe ich Git-Self-Service für mehrere Teams umgesetzt: Eine neue Anwendung ist dann ein Pull Request im Team-Repository, kein Ticket beim Plattformteam.

## Promotion zwischen Stages

Promotion heißt in diesem Modell: Die Änderung, die in Test funktioniert, wird per Pull Request in das Prod-Verzeichnis übernommen, typischerweise ein neuer Image-Tag in der `kustomization.yaml`. CI-Pipelines können diesen PR automatisch öffnen, die Freigabe bleibt ein Review. Für viele Teams reicht das völlig.

Für Rollouts über viele Cluster einer Stage bietet Argo CD Progressive Syncs. Mit `strategy.type: RollingSync` synchronisiert das ApplicationSet seine Applications in Schritten nach Labels, etwa erst Standort A, dann Standort B. Das Feature ist Beta, wird über `applicationsetcontroller.enable.progressive.syncs` aktiviert und schaltet Auto-Sync für die erzeugten Applications ab.

```yaml
spec:
  strategy:
    type: RollingSync
    rollingSync:
      steps:
        - matchExpressions:
            - key: site
              operator: In
              values: ["site-a"]
        - matchExpressions:
            - key: site
              operator: In
              values: ["site-b"]
          maxUpdate: 50%
```

Wer komplexere Promotion-Ketten mit Freigaben und Verifikation braucht, sollte sich Kargo ansehen, das auf Argo CD aufsetzt. Ich würde es erst einführen, wenn der PR-basierte Weg nachweislich nicht mehr reicht.

## Secrets

Die [Argo-CD-Doku](https://argo-cd.readthedocs.io/en/stable/operator-manual/secret-management/) rät ausdrücklich davon ab, Secrets bei der Manifest-Generierung per Plugin einzuspielen, unter anderem weil Argo CD gerenderte Manifeste im Klartext im Redis-Cache hält. Empfohlen wird, Secrets im Ziel-Cluster durch einen Operator zu erzeugen.

In der Praxis ist das meist External Secrets Operator mit Vault. In Git liegt nur die Referenz:

```yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: orders-db
  namespace: team-a-orders
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-team-a
    kind: SecretStore
  target:
    name: orders-db
  data:
    - secretKey: password
      remoteRef:
        key: team-a/orders/db
        property: password
```

Pro Cluster sollte es in Vault einen eigenen Kubernetes-Auth-Mount geben, pro Team eine eigene Rolle und Policy. Dann kann ein kompromittierter Dev-Cluster keine Prod-Secrets lesen. Sealed Secrets ist eine Alternative für kleinere Umgebungen ohne Vault. Bei vielen Clustern wird die Verwaltung der Schlüsselpaare pro Cluster und deren Sicherung aber schnell zur eigenen Aufgabe.

## Skalierung

Ab einigen hundert Applications ist der Application Controller der Engpass. Er lässt sich als StatefulSet mit mehreren Replicas betreiben, `ARGOCD_CONTROLLER_REPLICAS` muss der Replica-Zahl entsprechen. Verteilt wird pro Cluster, nicht pro Application. Ein einzelner sehr großer Cluster bleibt also auf einem Shard.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-cmd-params-cm
  namespace: argocd
data:
  controller.sharding.algorithm: consistent-hashing
  controller.status.processors: "50"
  controller.operation.processors: "25"
  reposerver.parallelism.limit: "10"
```

Die Algorithmen `round-robin` und `consistent-hashing` sind laut Feature-Maturity-Seite Alpha, `legacy` verteilt nach UID und oft ungleichmäßig. Einzelne Cluster lassen sich über das Feld `shard` im Cluster-Secret fest zuordnen. Die Processor-Werte 50 und 25 entsprechen der Doku-Empfehlung für etwa 1.000 Applications. Das Parallelism-Limit am Repo-Server verhindert OOM-Kills bei vielen gleichzeitigen Helm-Renderings. Git-Webhooks statt Polling entlasten Repo-Server und Git-Server gleichermaßen.

## Sicherheit der Cluster-Credentials

`argocd cluster add` legt im Ziel-Cluster einen Service Account mit cluster-weiten Vollrechten an. Für Produktion ist das zu viel. Besser ist ein eigener Service Account mit einer ClusterRole, die genau die Ressourcen erlaubt, die Argo CD dort verwalten soll, und eine Rotation des Tokens über Vault und External Secrets. Wo möglich, sind kurzlebige Credentials über `execProviderConfig` oder Cloud-IAM-Anbindungen langlebigen Bearer-Tokens vorzuziehen.

Der Management-Cluster selbst ist das wertvollste Ziel der Plattform. Er gehört in ein eigenes Netzsegment, Admin-Zugriff nur über SSO-Gruppen, die lokale Admin-Rolle deaktiviert. Argo CD 3.5 bringt zudem optionales mTLS zwischen den internen Komponenten und Signaturprüfung von Git-Commits über das neue Source-Integrity-Subsystem.

## Betrieb in abgeschotteten Netzen

In abgeschotteten Umgebungen, die ich betreut habe, galt immer: Jede externe Abhängigkeit muss intern gespiegelt werden. Git-Server, Helm-Charts als OCI-Artefakte in einer internen Registry, Container-Images und die Argo-CD-Images selbst. Der Repo-Server darf keine Charts aus dem Internet nachladen, Helm-Dependencies müssen vorher vendored oder gespiegelt sein.

Eine Trennung nach Standorten oder Netzsegmenten ist ein Argument für eine Instanz pro Standort oder für das Agent-Modell, bei dem nur ausgehende Verbindungen von den Workload-Clustern nötig sind. Mehr zu den Grundlagen steht im Artikel zu [Kubernetes im Air-Gap](/blog/kubernetes-air-gapped/), zur Kombination mit Crossplane in [Crossplane als Plattform-API](/blog/crossplane-plattform-apis/).

## Typische Fallstricke

### Sync-Waves und App-of-Apps

Sync-Waves über `argocd.argoproj.io/sync-wave` ordnen Ressourcen innerhalb einer Application. Bei App-of-Apps wartet die Root-Application aber standardmäßig nicht auf die Health der Kind-Applications, weil Argo CD seit Version 1.8 keinen eingebauten Health-Check für Application-Ressourcen mehr hat. Wer Reihenfolgen über Applications hinweg braucht, etwa CRDs vor Operatoren, muss eine Health-Customization für `argoproj.io/Application` in `argocd-cm` hinterlegen. Für CRs, deren CRD erst in derselben Sync-Operation entsteht, hilft `SkipDryRunOnMissingResource=true`.

### Ressourcen-Drift

HPAs, Mutating Webhooks und Operatoren ändern Felder, die auch im Git stehen. Ergebnis sind dauerhaft "OutOfSync"-Applications oder Self-Heal-Schleifen. Abhilfe schaffen gezielte `ignoreDifferences` mit `RespectIgnoreDifferences=true` und Server-Side Apply. Pauschale Ignore-Regeln auf ganze Kinds verdecken dagegen echte Drift.

### App-of-Apps-Wildwuchs

Verschachtelte App-of-Apps über drei oder vier Ebenen sind kaum noch nachvollziehbar. Ich halte es bei einer Root-Application, die AppProjects und ApplicationSets ausrollt. Alles darunter erzeugen ApplicationSets aus Daten, nicht handgeschriebene Application-Manifeste.

### Git-Generator als Lastquelle

Ein Team mit Schreibrechten auf ein Generator-Repo kann versehentlich hunderte Applications erzeugen. Die ApplicationSet-Doku nennt das als Risiko. Code-Owner-Regeln auf `config.yaml` und Limits im Review helfen mehr als nachträgliches Aufräumen.

## Einordnung

Multi-Cluster-GitOps mit Argo CD lohnt sich ab etwa fünf Clustern oder sobald mehr als ein Team deployt. Darunter ist eine Instanz pro Cluster mit einfachen Applications oft pragmatischer.

Meine klare Empfehlung für Organisationen mit vielen Clustern: ein zentrales Argo CD pro Sicherheitszone, Cluster über Labels beschrieben, ApplicationSets ausschließlich in der Hand des Plattformteams, ein AppProject mit Impersonation pro Fachteam, Stages als Verzeichnisse und Secrets über External Secrets aus Vault. Sharding erst aktivieren, wenn Metriken es zeigen. argocd-agent im Blick behalten und dort pilotieren, wo Netztrennung das Pull-Modell erzwingt, für das gesamte Produktionssetup aber erst nach einem stabilen Release.

Nicht sinnvoll ist Argo CD als Ersatz für Cluster-Provisionierung. Dafür sind Werkzeuge wie Crossplane oder Terraform gedacht, siehe [Terraform oder Crossplane](/blog/terraform-oder-crossplane/). Wer eine solche Plattform aufbauen oder ein bestehendes Setup prüfen lassen will, findet meine [Leistungen](/#leistungen) und den [Kontakt](/#kontakt) auf der Startseite.
