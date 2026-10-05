---
title: "Crossplane v2: Plattform-APIs für Self-Service-Infrastruktur"
description: "Crossplane v2 in der Praxis: namespaced XRs, XRDs und Function-Pipelines als Plattform-API, dazu GitOps mit Argo CD, RBAC, Versionierung und Fallstricke."
pubDate: 2026-10-06
tags: ["Crossplane", "Platform Engineering", "Kubernetes", "GitOps", "Self-Service"]
summary: "Mit Crossplane v2 definiert ein Plattformteam eigene Kubernetes-APIs (XRDs), die Fachteams als namespaced Composite Resources in ihrem Namespace bestellen; Claims sind dafür nicht mehr nötig. Compositions laufen ausschließlich als Function-Pipeline, Managed Resources sind namespaced und steuern ihr Löschverhalten über managementPolicies statt deletionPolicy. Entscheidend für den Betrieb sind ein schmales API-Design, striktes RBAC, getestete Compositions und kontrollierte Provider-Upgrades."
faq:
  - q: "Gibt es in Crossplane v2 noch Claims?"
    a: "Nur noch für XRDs im Kompatibilitätsmodus scope: LegacyCluster, also v1-artige XRDs. Neue XRDs mit apiextensions.crossplane.io/v2 und scope: Namespaced oder Cluster unterstützen keine Claims. Fachteams legen die Composite Resource stattdessen direkt in ihrem Namespace an."
  - q: "Wie verhindere ich, dass Crossplane beim Löschen Cloud-Ressourcen entfernt?"
    a: "Bei namespaced Managed Resources gibt es kein spec.deletionPolicy mehr. Man setzt managementPolicies ohne Delete, etwa Create, Observe, Update und LateInitialize. Zusätzlich schützt ein Usage-Objekt (protection.crossplane.io/v1beta1) eine Ressource gegen versehentliches Löschen."
  - q: "Wie teste ich eine Crossplane Composition ohne Cluster?"
    a: "Mit crossplane composition render aus der Crossplane CLI. Der Befehl führt die Function-Pipeline lokal in Docker aus und gibt XR und Composed Resources als YAML aus. Die Ausgabe lässt sich per crossplane resource validate gegen XRD- und Provider-Schemas prüfen, was sich gut in CI einbauen lässt."
  - q: "Funktionieren Crossplane und Argo CD zusammen?"
    a: "Ja, das ist ein verbreitetes Muster: Argo CD synchronisiert XRDs, Compositions und die XRs der Teams aus Git, Crossplane reconciliert daraus die Infrastruktur. Wichtig sind annotation-basiertes Resource Tracking, Health Checks für Crossplane-Ressourcen und das Ausblenden von ProviderConfigUsage-Objekten."
  - q: "Muss ich v1-Compositions vor dem Upgrade auf Crossplane v2 umbauen?"
    a: "Compositions im Modus Resources (natives Patch and Transform) müssen vorher auf Function-Pipelines migriert werden, die v1.20 CLI kann sie konvertieren. Pipeline-Compositions und Legacy-XRs laufen unter v2 weiter. Upgrades erfolgen über v1.20 und dann eine Minor-Version nach der anderen."
sources:
  - title: "Crossplane Docs: What's New in v2?"
    url: "https://docs.crossplane.io/latest/whats-new/"
  - title: "Crossplane Docs: Composite Resource Definitions"
    url: "https://docs.crossplane.io/latest/composition/composite-resource-definitions/"
  - title: "Crossplane Docs: Compositions"
    url: "https://docs.crossplane.io/latest/composition/compositions/"
  - title: "Crossplane Docs: Managed Resources"
    url: "https://docs.crossplane.io/latest/managed-resources/managed-resources/"
  - title: "Crossplane Docs: Upgrade to Crossplane v2"
    url: "https://docs.crossplane.io/latest/guides/upgrade-to-crossplane-v2/"
  - title: "Crossplane Docs: Configuring Crossplane with Argo CD"
    url: "https://docs.crossplane.io/latest/guides/crossplane-with-argo-cd/"
---

Crossplane macht aus einem Kubernetes-Cluster eine Control Plane für Infrastruktur. Der eigentliche Nutzen für Plattformteams liegt aber nicht darin, S3-Buckets oder Datenbanken als YAML zu beschreiben, sondern darin, eigene APIs zu bauen: Ein Fachteam bestellt ein `ObjectBucket` oder eine `PostgresDatabase` mit drei Feldern, und die Plattform entscheidet, welche Cloud-Ressourcen, Tags, Policies und Zugangsdaten dahinterstehen.

Dieser Artikel richtet sich an Plattform-Leads und Architekt:innen, die Self-Service-Infrastruktur mit Crossplane aufbauen oder eine bestehende v1-Installation modernisieren. Er beschreibt das Modell von Crossplane v2, zeigt eine vollständige Plattform-API mit Composition Function und geht auf die Punkte ein, an denen solche Plattformen im Betrieb tatsächlich scheitern. Stand: Oktober 2026, Crossplane v2.4, Crossplane CLI v2.5.

## Was sich mit Crossplane v2 geändert hat

Crossplane v2 ist kein kosmetisches Major-Release. Wer Tutorials aus der v1-Zeit kennt, muss einige Annahmen über Bord werfen:

- **Composite Resources (XRs) sind standardmäßig namespaced.** Die XRD-API `apiextensions.crossplane.io/v2` hat ein Feld `scope` mit dem Default `Namespaced`. Ein namespaced XR kann nur Ressourcen im eigenen Namespace erzeugen.
- **Claims entfallen für neue APIs.** Namespaced und `Cluster`-scoped XRs unterstützen keine Claims. Nur `scope: LegacyCluster`, der Default der alten XRD-API `v1`, behält Claims für die Abwärtskompatibilität.
- **Compositions laufen nur noch als Function-Pipeline.** Der native Patch-and-Transform-Modus (`mode: Resources`) ist entfernt. Wer bei YAML-Patches bleiben will, nutzt `function-patch-and-transform` als Pipeline-Schritt.
- **Managed Resources (MRs) sind namespaced.** Die neuen API-Gruppen tragen ein `.m.` im Namen, etwa `s3.aws.m.upbound.io/v1beta1` statt `s3.aws.upbound.io/v1beta2`. Cluster-scoped MRs funktionieren weiter, gelten aber als deprecated. Namespaced MRs sind für AWS vollständig verfügbar, andere Provider ziehen nach. Das muss man für jeden genutzten Provider prüfen.
- **Compositions dürfen beliebige Kubernetes-Ressourcen erzeugen**, also auch Deployments, Secrets oder fremde CRDs wie CloudNativePG-Cluster.
- **Die Crossplane-Felder eines XR liegen unter `spec.crossplane`** (`compositionRef`, `compositionRevisionRef`, `resourceRefs` usw.). Das trennt die Felder des Fachteams sauber von der Crossplane-Mechanik.
- **XRs haben keine nativen Connection Details mehr.** MRs schreiben weiterhin per `writeConnectionSecretToRef` Secrets. Für das XR komponiert man bei Bedarf selbst ein Secret.

Neu sind außerdem Operations (`ops.crossplane.io/v1alpha1`) für Day-2-Aufgaben; für Plattform-APIs sind sie zweitrangig.

## Die Bausteine einer Plattform-API

Eine Plattform-API besteht aus vier Ebenen, die man in der Architektur klar trennen sollte:

1. **Provider** installieren Controller und CRDs für ein externes System (AWS, Azure, Helm, Kubernetes). Jede CRD entspricht einem Managed-Resource-Typ.
2. **Managed Resources** bilden genau eine externe Ressource ab. `spec.forProvider` ist die Source of Truth; Änderungen außerhalb von Crossplane werden zurückgedreht.
3. **XRDs** definieren das Schema der eigenen API, vergleichbar mit einer CRD, aber mit Crossplane-spezifischen Optionen.
4. **Compositions** legen fest, welche Function-Pipeline ein XR in konkrete Ressourcen übersetzt.

Das Fachteam sieht idealerweise nur Ebene 3. Alles andere ist Implementierungsdetail der Plattform.

## Beispiel: eine Bucket-API für Fachteams

### Die XRD

Die XRD definiert, was ein Team bestellen darf. Gute Plattform-APIs sind schmal: wenige Felder, enge Enums, sinnvolle Defaults. Jedes zusätzliche Feld ist ein Versprechen, das man über Jahre halten muss.

```yaml
apiVersion: apiextensions.crossplane.io/v2
kind: CompositeResourceDefinition
metadata:
  name: objectbuckets.platform.example.com
spec:
  scope: Namespaced
  group: platform.example.com
  names:
    kind: ObjectBucket
    plural: objectbuckets
  versions:
    - name: v1alpha1
      served: true
      referenceable: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                region:
                  type: string
                  enum: ["eu-central-1", "eu-west-1"]
                  default: eu-central-1
                costCenter:
                  type: string
                  pattern: "^[0-9]{4,6}$"
                retainOnDelete:
                  type: boolean
                  default: false
              required:
                - costCenter
            status:
              type: object
              properties:
                arn:
                  type: string
```

Validierung gehört so weit wie möglich ins Schema. Enums, Patterns und CEL-Regeln (`x-kubernetes-validations`) greifen bereits im API-Server, also bevor Argo CD überhaupt einen Sync als erfolgreich meldet.

### Die Composition als Function-Pipeline

Für die Übersetzung nutze ich hier `function-go-templating`, weil die Syntax Teams mit Helm-Erfahrung vertraut ist. Für größere Logik sind KCL, Python oder eine eigene Function in Go besser geeignet, weil sich dort Unit-Tests schreiben lassen.

```yaml
apiVersion: pkg.crossplane.io/v1
kind: Function
metadata:
  name: crossplane-contrib-function-go-templating
spec:
  package: xpkg.crossplane.io/crossplane-contrib/function-go-templating:v0.9.2
---
apiVersion: apiextensions.crossplane.io/v1
kind: Composition
metadata:
  name: objectbucket-aws
spec:
  compositeTypeRef:
    apiVersion: platform.example.com/v1alpha1
    kind: ObjectBucket
  mode: Pipeline
  pipeline:
    - step: render-bucket
      functionRef:
        name: crossplane-contrib-function-go-templating
      input:
        apiVersion: gotemplating.fn.crossplane.io/v1beta1
        kind: GoTemplate
        source: Inline
        inline:
          template: |
            {{- $xr := .observed.composite.resource }}
            ---
            apiVersion: s3.aws.m.upbound.io/v1beta1
            kind: Bucket
            metadata:
              annotations:
                gotemplating.fn.crossplane.io/composition-resource-name: bucket
                {{- if eq (.observed.resources.bucket | getResourceCondition "Ready").Status "True" }}
                gotemplating.fn.crossplane.io/ready: "True"
                {{- end }}
            spec:
              {{- if $xr.spec.retainOnDelete }}
              managementPolicies: ["Create", "Observe", "Update", "LateInitialize"]
              {{- end }}
              forProvider:
                region: {{ $xr.spec.region }}
                tags:
                  cost-center: {{ $xr.spec.costCenter | quote }}
                  managed-by: crossplane
              providerConfigRef:
                kind: ClusterProviderConfig
                name: aws-platform
            {{- with getComposedResource . "bucket" }}
            ---
            apiVersion: platform.example.com/v1alpha1
            kind: ObjectBucket
            status:
              arn: {{ dig "status" "atProvider" "arn" "" . | quote }}
            {{- end }}
```

Einige Details, die in v2 wichtig sind:

- Das Template setzt keinen `metadata.namespace`. Bei namespaced XRs ignoriert Crossplane Namespaces im Template und verwendet den Namespace des XR.
- `providerConfigRef` braucht in v2 neben `name` auch `kind`. Ohne Angabe greift `ClusterProviderConfig` mit dem Namen `default`.
- `retainOnDelete` steuert das Löschverhalten über `managementPolicies`, nicht über `deletionPolicy`. Dazu weiter unten mehr.

### Die Bestellung durch das Fachteam

```yaml
apiVersion: platform.example.com/v1alpha1
kind: ObjectBucket
metadata:
  name: reports
  namespace: team-a
spec:
  costCenter: "4711"
  region: eu-central-1
```

Mehr landet nicht im Git-Repository des Teams. Es gibt keinen Claim und kein separates cluster-weites XR mehr.

## Zusammenspiel mit GitOps und Argo CD

Crossplane und Argo CD ergänzen sich, weil beide auf dem Reconcile-Prinzip beruhen. Bewährt hat sich eine Trennung in zwei Ebenen von Argo-CD-Applications: Das Plattformteam verwaltet Provider, Functions, XRDs und Compositions in einem eigenen Repository mit eigenem Review-Prozess. Fachteams verwalten ihre XRs in ihren Repositories, jeweils auf den eigenen Namespace begrenzt über ein Argo-CD-`AppProject`.

Die Crossplane-Doku empfiehlt einige Einstellungen in `argocd-cm`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-cm
  namespace: argocd
data:
  application.resourceTrackingMethod: annotation
  resource.exclusions: |
    - apiGroups:
        - "*"
      kinds:
        - ProviderConfigUsage
```

Annotation-Tracking ist seit Argo CD 3.0 der Default; bei älteren Installationen verhindert es, dass Argo CD von Crossplane erzeugte Objekte fälschlich als eigene Ressourcen behandelt. Zusätzlich liefert die Crossplane-Doku Lua-Health-Checks für `*.crossplane.io/*` und `*.upbound.io/*`, die `Ready`- und `Synced`-Conditions auswerten. Ohne sie zeigt Argo CD ein XR als gesund an, obwohl der Bucket noch gar nicht existiert. Bei vielen MRs lohnt es sich außerdem, `ARGOCD_K8S_CLIENT_QPS` am Application Controller zu erhöhen. Die Doku nennt 300 statt des Defaults 50.

Wie man das über viele Cluster organisiert, beschreibe ich in [Argo CD Multi-Cluster-GitOps](/blog/argocd-multi-cluster-gitops/). In abgeschotteten Umgebungen, die ich betreut habe, hat sich genau diese Kombination aus Argo CD und Crossplane für Self-Service bewährt.

## Berechtigungen und RBAC

Namespaced XRs machen RBAC endlich einfach: Ein normales `Role`/`RoleBinding` pro Team-Namespace genügt. Entscheidend ist, was man nicht freigibt.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: platform-self-service
  namespace: team-a
rules:
  - apiGroups: ["platform.example.com"]
    resources: ["objectbuckets"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: ["s3.aws.m.upbound.io"]
    resources: ["*"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: platform-self-service
  namespace: team-a
subjects:
  - kind: Group
    name: team-a-developers
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: platform-self-service
  apiGroup: rbac.authorization.k8s.io
```

Weil die Composed Resources im Team-Namespace liegen, könnte ein Team mit Schreibrechten auf MRs die Plattform-API umgehen und Tags oder Regionen direkt ändern. Lesezugriff auf MRs ist für das Debugging sinnvoll, Schreibzugriff nicht.

Auf der anderen Seite braucht Crossplane selbst Rechte. Der Service Account darf alle MRs und XRs verwalten. Für andere Ressourcentypen, etwa CRDs von CloudNativePG, muss man eine `ClusterRole` mit dem Label `rbac.crossplane.io/aggregate-to-crossplane: "true"` anlegen. Das ist gewollt: Jede Erweiterung der Rechte von Crossplane sollte ein bewusster Review-Schritt im Plattform-Repository sein.

Für Zugangsdaten zur Cloud gibt es zwei Muster. Eine `ClusterProviderConfig`, die nur die Composition referenziert, hält Credentials zentral. Namespaced `ProviderConfig`-Objekte pro Team erlauben getrennte Accounts oder Subscriptions je Team. Die zweite Variante ist sauberer für Mandantentrennung, erfordert aber, dass die Composition den Namen der ProviderConfig festlegt und ihn nicht aus einem frei wählbaren Feld des Teams übernimmt.

## Versionierung von Plattform-APIs

XRDs basieren auf CRD-Versionierung, aber ohne Conversion Webhooks. Daraus folgen klare Regeln aus der Doku: Mehrere Versionen sind möglich, die Schemas dürfen bestehende Felder aber nicht inkompatibel ändern. Neue optionale Felder sind erlaubt, neue Pflichtfelder sind ein Breaking Change. Genau eine Version ist `referenceable` und bestimmt die `compositeTypeRef.apiVersion` der Compositions. Für echte Breaking Changes empfiehlt Crossplane eine neue XRD.

In der Praxis heißt das:

- Mit `v1alpha1` starten und erst dann auf `v1beta1` oder `v1` gehen, wenn das Schema einige Monate stabil ist.
- Alte Versionen erst auf `served: false` setzen, bevor man sie entfernt. Anfragen gegen die alte Version scheitern dann sichtbar, und man findet die Nachzügler.
- Laut Doku muss der Crossplane-Pod nach Schemaänderungen an einer XRD neu gestartet werden. Das sollte im Rollout-Prozess für XRD-Änderungen vorgesehen sein.

Compositions versioniert Crossplane automatisch als `CompositionRevision`. Standardmäßig wechseln alle XRs sofort auf eine neue Revision. Für riskante Änderungen setzt man im XRD `defaultCompositionUpdatePolicy: Manual` oder im XR `spec.crossplane.compositionUpdatePolicy: Manual` zusammen mit einer `compositionRevisionRef` und rollt Teams gezielt nacheinander aus. Mehrere Compositions für dieselbe XRD (etwa `objectbucket-aws` und `objectbucket-minio`) lassen sich über `defaultCompositionRef`, `enforcedCompositionRef` oder einen Selector unterscheiden.

## Testing mit crossplane composition render

Compositions sind Code und brauchen Tests. Die Crossplane CLI führt die Function-Pipeline lokal in Docker aus, ohne Cluster. In der aktuellen CLI heißt der Befehl `crossplane composition render`; Validierung und Trace liegen unter `crossplane resource`.

```bash
# Desired State aus XR, Composition und Functions berechnen
crossplane composition render xr.yaml composition.yaml functions.yaml \
  --xrd xrd.yaml \
  --observed-resources observed/ \
  --include-full-xr > rendered.yaml

# Ergebnis gegen XRD- und Provider-Schemas validieren
crossplane resource validate schemas/ rendered.yaml
```

Mit `--observed-resources` simuliert man bereits existierende Ressourcen, zum Beispiel einen Bucket mit gesetzter ARN, und prüft so auch Status-Logik und Readiness. Sinnvoll ist, die gerenderte Ausgabe in CI zusätzlich mit einer eingecheckten Erwartung zu vergleichen. Jeder Diff in einem Pull Request zeigt dann, welche Cloud-Ressourcen sich für alle Teams ändern würden.

## Typische Fallstricke

### Drift und Late Initialization

Crossplane überschreibt manuelle Änderungen in der Cloud-Konsole. Das ist gewollt, überrascht aber Teams, die im Notfall per Konsole eingreifen. Bei Feldern, die externe Systeme selbst verändern, etwa die gewünschte Größe einer autoskalierten Node Group, gehört der Wert nach `initProvider` statt `forProvider`. Late Initialization schreibt von der Cloud vergebene Werte zurück in `spec.forProvider`; wer das nicht will, lässt `LateInitialize` in den `managementPolicies` weg. Wie oft ein Provider auf Drift prüft, lässt sich pro MR mit der Annotation `crossplane.io/poll-interval` anpassen.

### Löschverhalten

Bei namespaced MRs gibt es `deletionPolicy` nicht mehr. Das frühere `Orphan` entspricht `managementPolicies: ["Create", "Observe", "Update", "LateInitialize"]`. Wichtiger als dieses Feld sind die Löschpfade, die man leicht übersieht:

- Wird ein Namespace gelöscht, löscht Kubernetes alle XRs darin und Crossplane damit die Cloud-Ressourcen.
- Gibt eine Function eine Ressource bei einem späteren Aufruf nicht mehr zurück, löscht Crossplane sie. Ein fehlerhaftes `if` im Template kann so produktive Datenbanken entfernen.
- Argo CD mit aktiviertem Prune löscht XRs, die aus Git verschwinden.

Für kritische Ressourcen empfehle ich ein `Usage`-Objekt aus `protection.crossplane.io/v1beta1`, das Löschanfragen mit einer Begründung ablehnt, plus `retainOnDelete`-Logik in der API. Die Annotation `crossplane.io/paused: "true"` stoppt Reconciliation, blockiert laut Doku aber auch das Löschen.

### Provider- und Crossplane-Upgrades

Crossplane unterstützt die jeweils letzten drei Minor-Versionen, bei vierteljährlichem Release-Takt also etwa neun Monate. Upgrades erfolgen eine Minor-Version nach der anderen mit dem jeweils neuesten Patch. Wer noch auf v1 ist, muss zuerst auf v1.20, das im November 2026 mit v2.5 sein Support-Ende erreicht. Release Notes gehören vor jedem Upgrade gelesen: v2.4 hat zum Beispiel die Benennung von Package-Revisionen und Spaltennamen in `kubectl get` geändert, was Monitoring-Skripte brechen kann.

Bei Providern sind die Upgrades oft heikler als bei Crossplane selbst, weil sich Schemas einzelner MRs ändern. Empfehlenswert ist, Provider-Versionen im Plattform-Repository zu pinnen, `revisionActivationPolicy: Manual` für kontrollierte Umschaltungen zu setzen und vorher alle Compositions gegen die neuen Schemas zu rendern. Bei der Migration auf `.m.`-Gruppen ist zu beachten, dass die API-Version oft auf `v1beta1` zurückgesetzt wurde, obwohl `forProvider` schematisch identisch ist. Laufende Compositions sollte man laut Upgrade-Guide nicht auf neue Gruppen umstellen, sondern neue Compositions für neue XRs anlegen. Ein automatisiertes Migrationswerkzeug für bestehende cluster-scoped XRs und MRs gibt es nach aktuellem Stand nicht.

### Ressourcenlast

Provider für große Clouds bringen Hunderte CRDs mit, und jede belastet API-Server und Controller. Statt Monolith-Providern nutzt man die Family-Provider (etwa nur `provider-aws-s3` und `provider-aws-rds`) und begrenzt aktive MR-Typen über eine `ManagedResourceActivationPolicy` (`apiextensions.crossplane.io/v1alpha1`). Crossplane v2 legt standardmäßig eine Policy an, die alles aktiviert; diese sollte man durch eine gezielte Liste ersetzen. Seit v2.4 skalieren Provider mit Safe-Start-Unterstützung auf null Replicas, solange keine ihrer Managed Resource Definitions aktiv ist. Für die Kapazitätsplanung zeigt `crossplane cluster top` (beta) den Ressourcenverbrauch der Crossplane-Pods.

## Betrieb: Observability und Security

Für die Fehlersuche ist `crossplane resource trace objectbucket reports -n team-a` das wichtigste Werkzeug. Es zeigt den Baum aus XR und Composed Resources mit `Synced`- und `Ready`-Status. Crossplane und Provider exportieren Prometheus-Metriken; Alarme auf lange `Synced=False`-Zustände fangen die meisten Probleme mit Credentials und Quotas ab, bevor ein Team sie meldet.

Sicherheitsseitig ist Crossplane ein privilegierter Controller mit Cloud-Credentials. Wo der Provider es unterstützt, gehört Workload Identity statt statischer Keys dazu, außerdem eine eng begrenzte Rolle im Cloud-Account. Admission Policies können zusätzlich verhindern, dass Compositions oder XRDs ohne Review im Cluster landen. In isolierten Umgebungen kommen Paket-Spiegelung und `ImageConfig`-Objekte für Registry und Pull-Secrets hinzu; Details dazu in [Kubernetes air-gapped betreiben](/blog/kubernetes-air-gapped/).

## Einordnung

Crossplane lohnt sich, wenn ein Plattformteam wiederkehrende Infrastruktur für viele Teams standardisiert anbieten will und Kubernetes ohnehin die zentrale Steuerungsebene ist. Die Stärke liegt in der API-Schicht: Teams bekommen ein schmales, validiertes Interface, die Plattform behält Kontrolle über Tags, Netzwerk, Verschlüsselung und Kosten. Mit v2 ist das Modell deutlich klarer geworden, weil Namespaces, RBAC und GitOps jetzt ohne den Umweg über Claims zusammenpassen.

Weniger sinnvoll ist Crossplane für einmalige Basis-Infrastruktur wie Landing Zones oder den Management-Cluster selbst, für kleine Organisationen ohne dediziertes Plattformteam und für Provider, deren namespaced Variante noch nicht verfügbar oder ausgereift ist. Dort ist Terraform oft die pragmatischere Wahl; die Abwägung beschreibe ich in [Terraform oder Crossplane](/blog/terraform-oder-crossplane/).

Meine Empfehlung: Neue Plattform-APIs nur noch mit `apiextensions.crossplane.io/v2` und `scope: Namespaced` bauen, mit zwei oder drei APIs starten, die echten Bedarf abdecken, und von Anfang an `crossplane composition render` in CI, Löschschutz für zustandsbehaftete Ressourcen und kontrollierte Provider-Upgrades einplanen. Wer eine Plattform dieser Art plant oder eine v1-Installation migrieren will, findet unter [Leistungen](/#leistungen) und [Kontakt](/#kontakt) den Weg zu mir.
