---
title: "KServe und vLLM: LLM-Inference auf eigenem Kubernetes betreiben"
description: "KServe und vLLM auf Kubernetes: Architektur, Deployment-Modi, GPU-Scheduling, Modell-Storage, Autoscaling und Betrieb ohne Internet. Mit YAML für KServe 0.21."
pubDate: 2026-10-06
tags: ["KServe", "vLLM", "Kubernetes", "LLM-Inference", "GPU"]
summary: "KServe stellt mit dem InferenceService und der Hugging-Face-Runtime (vLLM-Backend) eine OpenAI-kompatible LLM-API auf eigenem Kubernetes bereit; für fortgeschrittene Szenarien mit Prefix-aware Routing und disaggregiertem Serving gibt es den LLMInferenceService auf Basis von llm-d. Für die meisten Teams ist der Standard-Modus mit fest reservierten GPUs, Modellen aus S3/MinIO oder OCI-Images und KEDA-Autoscaling auf vLLM-Metriken der belastbarste Einstieg."
faq:
  - q: "Was ist der Unterschied zwischen InferenceService und LLMInferenceService in KServe?"
    a: "Der InferenceService (serving.kserve.io/v1beta1) ist die stabile, allgemeine API für prädiktive und generative Modelle und nutzt für LLMs die Hugging-Face-Runtime mit vLLM-Backend. Der LLMInferenceService ist eine eigene, noch als Alpha markierte CRD auf Basis von llm-d, die Gateway-API-Routing, einen KV-Cache-bewussten Scheduler sowie Prefill/Decode-Trennung und Multi-Node-Parallelismus mitbringt. Für einzelne Modelle auf einer oder wenigen GPUs reicht der InferenceService."
  - q: "Lohnt sich Scale-to-Zero mit Knative für große Sprachmodelle?"
    a: "Nur eingeschränkt. Ein Cold Start umfasst Pod-Scheduling, gegebenenfalls Image-Pull, das Laden von zig Gigabyte Gewichten in den GPU-Speicher und den Start der vLLM-Engine, was je nach Modell und Storage von unter einer Minute bis zu mehreren Minuten dauert. Für interaktive Anwendungen ist das zu lang, für selten genutzte Batch- oder Testmodelle kann Scale-to-Zero GPUs sparen."
  - q: "Wie stellt man LLMs in KServe ohne Internetzugang bereit?"
    a: "Die Modellgewichte werden außerhalb der abgeschotteten Umgebung geprüft, in einen internen S3-kompatiblen Speicher wie MinIO oder als OCI-Image in eine interne Registry übertragen und per storageUri referenziert. Zusätzlich müssen Container-Images der Runtime gespiegelt und Hub-Zugriffe der Runtime per HF_HUB_OFFLINE unterbunden werden."
  - q: "Welche vLLM-Metriken sind für Monitoring und Autoscaling wichtig?"
    a: "Für die Auslastung sind vllm:num_requests_running, vllm:num_requests_waiting und vllm:kv_cache_usage_perc entscheidend. Für die Nutzerwahrnehmung zählen die Histogramme vllm:time_to_first_token_seconds, vllm:inter_token_latency_seconds und vllm:e2e_request_latency_seconds. Laufende und wartende Requests eignen sich als Skalierungssignal für KEDA, GPU-Auslastung in Prozent dagegen kaum."
sources:
  - title: "KServe Doku: Generative Inference mit der Hugging-Face-Runtime"
    url: "https://kserve.github.io/website/docs/model-serving/generative-inference/overview"
  - title: "KServe Doku: LLMInferenceService Overview"
    url: "https://kserve.github.io/website/docs/model-serving/generative-inference/llmisvc/llmisvc-overview"
  - title: "KServe Doku: Autoscaling mit KEDA"
    url: "https://kserve.github.io/website/docs/model-serving/predictive-inference/autoscaling/keda-autoscaler"
  - title: "KServe Doku: OCI Storage (Modelcars)"
    url: "https://kserve.github.io/website/docs/model-serving/storage/providers/oci"
  - title: "vLLM Doku: Metrics"
    url: "https://docs.vllm.ai/en/latest/design/metrics.html"
  - title: "NVIDIA GPU Operator Release Notes"
    url: "https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/release-notes.html"
---

Wer Sprachmodelle nicht über eine externe API nutzen darf oder will, landet schnell bei der Frage, wie man vLLM sauber auf Kubernetes betreibt. KServe ist dafür der naheliegende Baustein: Es kapselt Modell-Download, Runtime, Routing und Autoscaling hinter einer deklarativen API und gibt Data-Science-Teams eine OpenAI-kompatible Schnittstelle, ohne dass jedes Team eigene Deployments, Services und Ingress-Regeln pflegt.

Dieser Artikel richtet sich an Plattform-Teams, die LLM-Inference als Self-Service anbieten wollen, auch in abgeschotteten Umgebungen. Stand: Oktober 2026, aktuell ist KServe 0.21 (die Online-Doku ist auf Version 0.20 gestellt), NVIDIA GPU Operator 26.7. Einige Empfehlungen stammen aus dem Betrieb solcher Plattformen in abgeschotteten Umgebungen, die ich betreut habe.

## Architektur: zwei APIs für LLMs

KServe hat sich in zwei Richtungen aufgeteilt. Der klassische `InferenceService` (`serving.kserve.io/v1beta1`) bedient prädiktive und generative Modelle. Daneben steht der `LLMInferenceService`, eine eigene CRD auf Basis von llm-d, die das Projekt selbst als Teil seiner GenAI-first-Ausrichtung beschreibt.

### InferenceService mit Hugging-Face-Runtime

Für LLMs wählt man im `InferenceService` das `modelFormat` `huggingface`. Der Controller sucht dazu eine passende `ClusterServingRuntime` (clusterweit, vom Plattform-Team gepflegt) oder `ServingRuntime` (namespaced, für teamspezifische Varianten). Die mitgelieferte Hugging-Face-Runtime nutzt vLLM als Standard-Backend. Über `--backend` lässt sich zwischen `auto`, `vllm` und `huggingface` wählen; unterstützt vLLM eine Architektur nicht, fällt `auto` auf das Transformers-Backend zurück.

Die Trennung zwischen Runtime und InferenceService ist für Plattformen wichtig. Das Plattform-Team legt Image, Default-Argumente, Security-Context und Ports in der `ClusterServingRuntime` fest. Teams referenzieren nur noch Modellformat, Speicherort und Ressourcen. Wer vLLM in einer bestimmten Version oder mit eigenem Image erzwingen will, pflegt das zentral an einer Stelle.

### LLMInferenceService und llm-d

Der `LLMInferenceService` ist für Szenarien gedacht, die ein einzelner vLLM-Pod hinter einem Service nicht mehr abdeckt: Gateway-API-Routing über `HTTPRoute`, ein Scheduler mit KV-Cache- und Prefix-bewusster Endpunktauswahl, Trennung von Prefill und Decode sowie Tensor-, Daten- und Expert-Parallelismus über mehrere Nodes. Die API ist weiterhin Alpha; die Doku zeigt `v1alpha1`, mit 0.21 wurden die Samples auf `v1alpha2` umgestellt. In 0.21 kamen unter anderem direkte KEDA-Skalierung, LoRA-Adapter aus dem lokalen Model Cache und Rollout-Strategien hinzu.

Meine Empfehlung: Wer ein oder mehrere Modelle in der Größenordnung bis etwa 70B auf einzelnen Nodes betreibt, fährt mit dem `InferenceService` stabiler. Den `LLMInferenceService` evaluiert man, wenn Prefix-Caching über Replikas hinweg oder disaggregiertes Serving einen messbaren Unterschied macht und das Team bereit ist, Alpha-API-Änderungen mitzugehen.

## Deployment-Modi: Standard oder Knative

KServe kennt für den `InferenceService` zwei relevante Modi, gesteuert über die Annotation `serving.kserve.io/deploymentMode` oder global im ConfigMap `inferenceservice-config`:

- `Standard` (früher RawDeployment): normale Kubernetes-Deployments, Services und HPA oder KEDA. Kein Knative nötig.
- `Knative` (früher Serverless): Knative Serving übernimmt Revisionen, Traffic-Splitting und den Knative Pod Autoscaler, inklusive Scale-to-Zero.

ModelMesh existiert noch, spielt für LLMs aber keine Rolle. Der Standard-Modus ist für GPU-Workloads in den meisten Fällen die bessere Wahl. Knative bringt eine zusätzliche Datenpfad-Komponente (Queue-Proxy, Activator), eigene Upgrade-Zyklen und Abhängigkeiten zur Netzwerkschicht mit. Der Gewinn, Scale-to-Zero, ist bei großen Modellen wegen des Cold Starts begrenzt (siehe unten). Einige Distributionen haben daraus bereits Konsequenzen gezogen und den Serverless-Modus abgekündigt.

Die Installation trennt die Modi inzwischen sauber: Es gibt Skripte für Standard-Mode, Knative-Mode und ein reines LLMInferenceService-Setup. Kubernetes 1.32 ist Mindestvoraussetzung.

## GPU-Scheduling mit dem NVIDIA GPU Operator

Der GPU Operator installiert und verwaltet Treiber, Container Toolkit, Device Plugin, GPU Feature Discovery, DCGM Exporter und MIG Manager als DaemonSets. Seit Version 25.10 ist CDI standardmäßig aktiv. Mit 26.7 kam der DRA-Treiber für NVIDIA-GPUs (v0.5.0) hinzu, der Kubernetes 1.34.2 oder neuer voraussetzt. Für die meisten KServe-Setups ist das klassische Extended Resource `nvidia.com/gpu` aber weiterhin der Weg, den die Runtime erwartet.

Drei Regeln haben sich bewährt:

1. GPU-Nodes tainten (zum Beispiel `nvidia.com/gpu=present:NoSchedule`), damit keine normalen Workloads die teuren Nodes belegen. Nur Inference-Pods bekommen die passende Toleration.
2. Über die Labels von GPU Feature Discovery (`nvidia.com/gpu.product`, `nvidia.com/gpu.memory`) auf die GPU-Klasse selektieren, die das Modell tatsächlich braucht. Ein 8B-Modell mit langem Kontext auf einer 24-GB-Karte und dasselbe Modell auf einer 80-GB-Karte verhalten sich grundverschieden.
3. GPU-Requests und Limits identisch setzen und CPU sowie RAM großzügig dimensionieren. vLLM braucht Host-Speicher für Tokenizer, Laden der Gewichte und gegebenenfalls CPU-Offloading.

Time-Slicing teilt GPUs ohne Speicherisolation und ist für LLM-Serving riskant, weil vLLM per `--gpu-memory-utilization` einen festen Anteil des GPU-Speichers reserviert. MIG bietet echte Isolation, lohnt sich aber nur für kleine Modelle.

## Modell-Storage: S3, PVC oder OCI

Die Frage, woher die Gewichte kommen, entscheidet über Startzeit und Betreibbarkeit.

S3 beziehungsweise MinIO ist der Normalfall. Ein Storage-Initializer lädt das Modell beim Pod-Start nach `/mnt/models`. Zugangsdaten liegen in einem Secret mit KServe-Annotationen (`serving.kserve.io/s3-endpoint`, `s3-usehttps`, `s3-region`), das über einen ServiceAccount an den InferenceService gebunden wird. Nachteil: Jeder neue Pod lädt das komplette Modell erneut.

PVCs (`pvc://<name>/<pfad>`) vermeiden den Download, verlagern das Problem aber auf ReadWriteMany-fähigen Storage, dessen Lesedurchsatz beim gleichzeitigen Start mehrerer Replikas oft der Engpass ist.

Modelcars (`oci://registry.example.com/models/llama:1.0`) verpacken Modelle als OCI-Image. Der Runtime-Container greift über einen gemeinsamen Prozess-Namespace und einen Symlink direkt auf `/models` im Modelcar zu, ohne Kopie. Das Feature ist standardmäßig deaktiviert und wird über `enableModelcar: true` im Abschnitt `storageInitializer` des ConfigMaps `inferenceservice-config` aktiviert. Der Vorteil: Der Image-Cache des Nodes wirkt als Modell-Cache, und die Registry übernimmt Versionierung, Signaturen und Replikation. Feste Tags statt `latest` sind Pflicht. Mit 0.21 kam zusätzlich `oci+fetch://` hinzu, das Inhalte eines OCI-Artefakts lädt, statt es als Container zu starten.

Ergänzend gibt es den lokalen Model Cache (`LocalModelCache`, Alpha), der Modelle vorab auf Node-Gruppen verteilt. Für häufig skalierte Modelle ist das der wirksamste Hebel gegen lange Startzeiten.

## Konkretes Beispiel: vLLM im Standard-Modus

Das folgende Beispiel lädt ein Modell aus einem internen MinIO, läuft im Standard-Modus auf einem dedizierten GPU-Node und skaliert per KEDA anhand der laufenden vLLM-Requests. Es setzt KServe 0.20 oder 0.21 sowie installiertes KEDA und Prometheus voraus.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: minio-models
  namespace: team-a
  annotations:
    serving.kserve.io/s3-endpoint: minio.platform.svc.cluster.local:9000
    serving.kserve.io/s3-usehttps: "1"
    serving.kserve.io/s3-region: us-east-1
type: Opaque
stringData:
  AWS_ACCESS_KEY_ID: team-a-reader
  AWS_SECRET_ACCESS_KEY: change-me
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: models-reader
  namespace: team-a
secrets:
  - name: minio-models
---
apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: llama-31-8b
  namespace: team-a
  annotations:
    serving.kserve.io/deploymentMode: Standard
    serving.kserve.io/autoscalerClass: keda
spec:
  predictor:
    serviceAccountName: models-reader
    minReplicas: 1
    maxReplicas: 3
    autoScaling:
      metrics:
        - type: External
          external:
            metric:
              backend: prometheus
              serverAddress: http://prometheus.monitoring.svc.cluster.local:9090
              query: sum(vllm:num_requests_running{namespace="team-a"})
            target:
              type: Value
              value: "16"
    nodeSelector:
      nvidia.com/gpu.product: NVIDIA-L40S
    tolerations:
      - key: nvidia.com/gpu
        operator: Exists
        effect: NoSchedule
    model:
      modelFormat:
        name: huggingface
      storageUri: s3://models/meta-llama/Llama-3.1-8B-Instruct
      args:
        - --model_name=llama-31-8b
        - --backend=vllm
        - --max-model-len=8192
        - --gpu-memory-utilization=0.90
      env:
        - name: HF_HUB_OFFLINE
          value: "1"
      resources:
        requests:
          cpu: "4"
          memory: 32Gi
          nvidia.com/gpu: "1"
        limits:
          cpu: "8"
          memory: 32Gi
          nvidia.com/gpu: "1"
```

Der Zielwert von 16 laufenden Requests ist ein Startwert, kein Richtwert. Er hängt von Modellgröße, Kontextlänge und GPU ab und muss per Lasttest ermittelt werden. Die Prometheus-Query sollte man in der Praxis zusätzlich auf das konkrete InferenceService-Label einschränken.

## OpenAI-kompatible API

Die Hugging-Face-Runtime stellt die OpenAI-Endpunkte unter dem Präfix `/openai` bereit, also `/openai/v1/chat/completions` und `/openai/v1/completions`. Das Präfix trennt sie von KServes eigenem V1/V2-Protokoll und lässt sich über die Umgebungsvariable `KSERVE_OPENAI_ROUTE_PREFIX` anpassen oder mit einem leeren String entfernen. Das ist relevant, weil viele Clients und Frameworks `/v1` direkt hinter der Base-URL erwarten.

```bash
curl -s https://llama-31-8b-team-a.inference.example.com/openai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"model": "llama-31-8b", "messages": [{"role": "user", "content": "Hallo"}], "max_tokens": 128}'
```

Der Modellname im Request entspricht `--model_name`. Authentifizierung bringt KServe selbst nicht mit; sie gehört ins Gateway (siehe Security).

## Autoscaling und Cold Starts

CPU- oder GPU-Auslastung taugen als Skalierungssignal kaum. vLLM hält die GPU durch Continuous Batching gut ausgelastet, und die reservierte Speichermenge ist konstant. Aussagekräftig sind Warteschlange und parallele Requests, also `vllm:num_requests_waiting` und `vllm:num_requests_running`. Im Standard-Modus nutzt man dafür KEDA wie im Beispiel, im Knative-Modus `scaleMetric: concurrency` mit `scaleTarget`.

Scale-to-Zero (`minReplicas: 0`, nur im Knative-Modus) klingt bei teuren GPUs verlockend. Ein Cold Start besteht aber aus Node-Bereitstellung (falls der Cluster-Autoscaler erst einen GPU-Node holen muss), Image-Pull des mehrere Gigabyte großen vLLM-Images, Laden der Gewichte, Kopieren in den GPU-Speicher, Profiling des KV-Cache und gegebenenfalls CUDA-Graph-Capturing. Bei einem 8B-Modell auf vorbereitetem Node sind das grob eine bis zwei Minuten, bei 70B und Download aus S3 deutlich mehr. Die genauen Werte hängen stark von Storage-Durchsatz und Caching ab. Kein Chat-Client wartet so lange; Timeouts an Gateway und Activator müssen entsprechend hoch sein.

Gegen Cold Starts helfen vorgeladene Images auf GPU-Nodes, Modelcars oder der lokale Model Cache, und vor allem `minReplicas: 1` für alles, was interaktiv genutzt wird. Scale-to-Zero reserviere ich für Test- und Batch-Modelle.

## Multi-Tenancy und Self-Service

Ein sinnvoller Zuschnitt ist ein Namespace pro Team, in dem das Team `InferenceService`-Objekte selbst anlegt. Das Plattform-Team stellt bereit:

- freigegebene `ClusterServingRuntime`-Objekte mit gepinnten Images, während Teams keine eigenen Runtimes anlegen dürfen (per RBAC und Admission Policy durchgesetzt),
- `ResourceQuota` mit `requests.nvidia.com/gpu` pro Namespace, damit ein Team nicht alle GPUs belegt,
- Policies (Kyverno oder ValidatingAdmissionPolicy), die erlaubte Storage-URIs auf interne Buckets und Registries beschränken und `hf://` verbieten,
- vorkonfigurierte Secrets und ServiceAccounts für den Modellzugriff.

Ausgerollt wird per GitOps, etwa mit Argo CD und Crossplane: Teams stellen ihre Modelle per Pull Request bereit. Wie man solche Plattform-APIs schneidet, beschreibe ich in [Plattform-APIs mit Crossplane](/blog/crossplane-plattform-apis/), die Verteilung über mehrere Cluster in [ArgoCD Multi-Cluster GitOps](/blog/argocd-multi-cluster-gitops/).

## Betrieb ohne Internetzugang

In abgeschotteten Umgebungen bricht die Standardkonfiguration an mehreren Stellen. `hf://`-URIs funktionieren nicht, die Runtime versucht gegebenenfalls Tokenizer oder Konfigurationsdateien vom Hub zu laden, und alle Images müssen aus einer internen Registry kommen.

Der Ablauf, der sich bewährt hat: Modelle werden auf einem verbundenen System heruntergeladen, Lizenz und Herkunft geprüft, Prüfsummen festgehalten und das Paket über die vorgesehene Schleuse importiert. Intern landet es in MinIO oder als Modelcar-Image in der Registry. In der Runtime setzt man `HF_HUB_OFFLINE=1`; Telemetrie ist in der Hugging-Face-Runtime bereits per Default deaktiviert. Wichtig ist, alle Dateien des Modell-Repositories mitzunehmen (Tokenizer, `generation_config.json`, Chat-Template), sonst fallen Fehler erst zur Laufzeit auf. Mehr zu Registry-Spiegelung und Image-Import steht in [Kubernetes Air-Gapped betreiben](/blog/kubernetes-air-gapped/).

## Monitoring

vLLM exponiert Prometheus-Metriken unter `/metrics`. Für ein Dashboard reichen wenige:

- `vllm:time_to_first_token_seconds`: wahrgenommene Reaktionszeit, wichtigste SLO-Metrik für Chat.
- `vllm:inter_token_latency_seconds` und `vllm:request_time_per_output_token_seconds`: Generierungsgeschwindigkeit.
- `vllm:e2e_request_latency_seconds`: Gesamtlatenz.
- `vllm:num_requests_running` und `vllm:num_requests_waiting`: Auslastung und Rückstau.
- `vllm:kv_cache_usage_perc`: Anteil belegter KV-Cache-Blöcke (früher `gpu_cache_usage_perc`). Dauerhaft nahe 1 bedeutet Preemption und steigende Latenz.
- `vllm:prompt_tokens_total` und `vllm:generation_tokens_total`: Token-Durchsatz, auch als Grundlage für interne Verrechnung pro Team.

Ergänzend liefert der DCGM Exporter des GPU Operators Hardware-Metriken wie Speicherbelegung, Temperatur und XID-Fehler. Alerts auf XID-Fehler und auf wachsende Warteschlangen fangen die meisten realen Störungen.

## Security

KServe bringt keine Authentifizierung für Inference-Endpunkte mit. Zugriff regelt man am Gateway (OIDC oder API-Keys) und intern über NetworkPolicies und mTLS. Die Grundlagen dazu beschreibe ich in [Istio mTLS und Zero Trust](/blog/istio-mtls-zero-trust/). KServe 0.21 hat TLS-Zertifikatsrotation und gehärtete RBAC-Regeln für die Controller ergänzt, was ein Upgrade aus Security-Sicht lohnend macht.

Weitere Punkte: Modell-Images und Gewichte gehören in die gleiche Supply-Chain-Prüfung wie Anwendungsimages, inklusive Signatur und Schwachstellenscan der Runtime. Modelle mit `trust_remote_code` führen beliebigen Python-Code aus und sollten nur nach Review zugelassen werden. Prompts und Antworten können personenbezogene Daten enthalten; Request-Logging ist deshalb bewusst zu konfigurieren und nicht pauschal einzuschalten.

## Einordnung

KServe mit vLLM ist sinnvoll, wenn mehrere Teams Modelle auf eigener Hardware betreiben sollen und das Plattform-Team Runtime, Storage und Zugriffe zentral steuern will. Für ein einzelnes Modell, das ein Team selbst betreibt, ist ein schlichtes vLLM-Deployment mit Helm-Chart weniger Aufwand.

Meine Empfehlung für den Einstieg: `InferenceService` im Standard-Modus, Hugging-Face-Runtime mit gepinntem vLLM-Image als `ClusterServingRuntime`, Modelle aus MinIO oder als Modelcar, KEDA auf `vllm:num_requests_running` oder `vllm:num_requests_waiting`, `minReplicas: 1` für interaktive Modelle. Knative nur dort, wo Scale-to-Zero für selten genutzte Modelle echten Nutzen bringt. Den `LLMInferenceService` beobachten und gezielt evaluieren, sobald Multi-Node-Modelle oder Prefix-aware Routing auf der Roadmap stehen, aber nicht als Fundament einer Plattform mit Betriebsverantwortung, solange die API Alpha ist.

Wer eine solche Plattform plant oder eine bestehende in eine abgeschottete Umgebung bringen muss: [Kontakt](/#kontakt).
