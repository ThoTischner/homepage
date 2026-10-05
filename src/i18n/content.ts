// All page content, keyed by language.

export type Lang = 'de' | 'en';
export const defaultLang: Lang = 'de';

export const contact = {
  name: 'Thomas Tischner',
  company: 'Thomas Tischner IT Systems',
  street: 'Georg-Strobel-Straße 54',
  city: '90489 Nürnberg',
  country: 'Deutschland',
  phone: '0911 39420155',
  phoneHref: 'tel:+4991139420155',
  email: 'thomas@tischner-itsystems.de',
  github: 'https://github.com/ThoTischner',
  githubLabel: 'github.com/ThoTischner',
  linkedin: 'https://www.linkedin.com/in/thomas-tischner/',
  linkedinLabel: 'linkedin.com/in/thomas-tischner',
};

export const routes = {
  de: { home: '/', imprint: '/impressum/', privacy: '/datenschutz/' },
  en: { home: '/en/', imprint: '/en/imprint/', privacy: '/en/privacy/' },
} as const;

export const mailto = (subject: string) =>
  `mailto:${contact.email}?subject=${encodeURIComponent(subject)}`;

const de = {
  meta: {
    title: 'Kubernetes-Berater & Plattformarchitekt | Thomas Tischner',
    description:
      'Freiberuflicher Kubernetes- und Plattformarchitekt aus Nürnberg: OpenShift, Rancher, GitOps, KI- und Data-Plattformen. CKS, CKA, CKAD. Remote in ganz DACH.',
    ogAlt: 'Thomas Tischner, Plattformarchitekt für Kubernetes und KI-/Data-Plattformen',
  },
  ui: {
    skip: 'Zum Inhalt springen',
    navLabel: 'Hauptnavigation',
    legalLabel: 'Rechtliches',
    langName: 'Deutsch',
    mailSubject: 'Projektanfrage',
    externalHint: '(externe Website)',
    langLabel: 'Sprache',
    playGame: 'Kubernetes Invaders spielen',
    playEgg: 'Easter Egg: Kubernetes Invaders starten',
    quoteOpen: '„',
    quoteClose: '“',
  },
  nav: [
    { href: '#profil', label: 'Profil' },
    { href: '#leistungen', label: 'Leistungen' },
    { href: '#projekte', label: 'Projekte' },
    { href: '#speaker', label: 'Speaker' },
    { href: '#werdegang', label: 'Werdegang' },
    { href: '#technologien', label: 'Stack' },
    { href: '#kontakt', label: 'Kontakt' },
  ],
  hero: {
    eyebrow: 'Freiberuflicher Kubernetes-Berater · Nürnberg · Remote / DACH',
    name: 'Thomas Tischner',
    role: 'Plattformarchitekt · Kubernetes & KI-/Data-Plattformen',
    pitch: 'Ich überführe komplexe Infrastruktur in skalierbare, automatisierte Plattformen.',
    cta: 'Projekt anfragen',
    secondary: 'GitHub',
    badges: ['Claude Certified Architect', 'CKS · CKA · CKAD', 'M.Sc. Applied AI (laufend)'],
    badgesLabel: 'Kurzprofil',
    portraitAlt: 'Porträt von Thomas Tischner',
    portraitOpen: 'Porträt vergrößern',
    portraitClose: 'Schließen',
  },
  profile: {
    id: 'profil',
    title: 'Profil',
    lead: 'Über 15 Jahre IT-Erfahrung, davon mehr als fünf Jahre als Architekt in der Beratung.',
    rest: 'Ich komme aus dem Rechenzentrum und kenne den Stack von der Hardware bis zum Modell-Deployment.',
    stats: [
      { value: '15+', label: 'Jahre IT-Erfahrung' },
      { value: '5+', label: 'Jahre Architekt in der Beratung' },
    ],
    focusTitle: 'Schwerpunkte',
    focus: [
      { title: 'Hochverfügbare Multi-Cluster-Plattformen', text: 'Skalierbar und automatisiert, von der Konzeption bis in den Betrieb.' },
      { title: 'KI- und Data-Science-Plattformen', text: 'Fachteams setzen ihre Use-Cases im Self-Service um.' },
      { title: 'Durchgängige Automatisierung', text: 'Von der Provisionierung bis zum Deployment, reproduzierbar per GitOps.' },
    ],
    motto: 'Pragmatisch, nachhaltig und vom Konzept bis in den Betrieb gedacht.',
  },
  services: {
    id: 'leistungen',
    title: 'Leistungen',
    items: [
      {
        title: 'Kubernetes-Plattformen',
        text: 'Multi-Cluster-Plattformen auf OpenShift, Rancher oder vSphere Tanzu, von der Planung bis in den Betrieb.',
      },
      {
        title: 'KI- und Data-Plattformen',
        text: 'Model Serving und LLM-Inference, Feature Store, GPU-Workloads und Kafka-Streaming für Data-Science-Teams.',
      },
      {
        title: 'GitOps und Automatisierung',
        text: 'Infrastruktur und Deployments als Code: ArgoCD, Crossplane, Tekton, Terraform, Ansible, Helm.',
      },
      {
        title: 'Security und Betrieb',
        text: 'Härtung nach CKS, Vault und PKI, Service Mesh, Monitoring. Dazu Architektur-Reviews, Workshops und Hackathons, zuletzt zu KI-Agenten im Plattformbetrieb.',
      },
    ],
  },
  projects: {
    id: 'projekte',
    title: 'Projekte',
    note: 'Kunden nenne ich nicht, nur die Branche.',
    items: [
      {
        title: 'KI-/Data-Science-Plattform',
        sector: 'Sicherheitskritisches Umfeld',
        period: '2024–2026',
        metrics: [
          { value: '~10', label: 'Cluster' },
          { value: '9', label: 'Nodes je Cluster' },
          { value: '2', label: 'Standorte' },
        ],
        text: 'Mandantenfähige Plattform in abgeschotteter Umgebung auf vSphere Tanzu, GitOps mit ArgoCD und Crossplane. Fachteams betreiben Model Serving, Feature Store, Workflows und GPU-Jobs selbst.',
        stack: ['KServe', 'vLLM', 'Feast', 'MLflow', 'Airflow', 'Trino', 'NVIDIA GPU Operator'],
      },
      {
        title: 'Echtzeit-Streaming',
        sector: 'Fahrzeugproduktion',
        period: '2023–2026',
        metrics: [{ value: '1–9 Mio.', label: 'Events pro Tag' }],
        text: 'Confluent-Kafka-Plattform für sicherheitsrelevante Fertigungsdaten, mit getrennten Rancher-Clustern je Stage und durchgehendem Monitoring. Deployments über Helm, Fleet und GitHub Actions.',
        stack: ['Confluent Kafka', 'Rancher', 'Fleet', 'Helm', 'GitHub Actions'],
      },
      {
        title: 'Streaming-Plattform',
        sector: 'Öffentlicher Sektor',
        period: '2021–2024',
        metrics: [
          { value: '~60 %', label: 'schnellere Deployments' },
          { value: '7', label: 'Fachbereiche' },
        ],
        text: 'OpenShift-Multi-Cluster, auf dem Fachbereiche per Git selbst deployen. CI/CD von GitLab auf Tekton migriert, Istio eingeführt, Secrets und PKI nach Vault verlagert.',
        stack: ['OpenShift', 'Tekton', 'Istio', 'HashiCorp Vault', 'Kafka'],
      },
      {
        title: 'Kubernetes-PaaS',
        sector: 'Öffentlicher Sektor',
        period: '2020–2021',
        metrics: [
          { value: '~40', label: 'Cluster' },
          { value: '~720', label: 'Nodes' },
        ],
        text: 'Organisationsweite Kubernetes-Plattform auf Baremetal und VMs, Provisionierung vollständig automatisiert.',
        stack: ['OpenShift', 'Ansible', 'VMware'],
      },
    ],
  },
  speaker: {
    id: 'speaker',
    title: 'Speaker',
    lead: 'In Vorträgen, Workshops und Hackathons zeige ich, wie Plattformen und KI in der Praxis zusammenspielen.',
    rest: 'Konkret, verständlich und aus echten Projekten.',
    imageAlt: 'Thomas Tischner bei einem Vortrag über KI-Agenten auf einer Bühne',
    caption: 'Vortrag „Was sind KI-Agenten?“',
    topicsTitle: 'Themen',
    topics: [
      { title: 'KI-Agenten in der Praxis', text: 'Vom Chat zum autonomen Helfer: Agenten, Tools, Workflows und ihr Nutzen im Plattformbetrieb.' },
      { title: 'KI- und Data-Plattformen auf Kubernetes', text: 'Model Serving, LLM-Inference und Self-Service für Data-Science-Teams.' },
      { title: 'Platform Engineering und GitOps', text: 'Wie Teams mit automatisierten Plattformen schneller und sicherer liefern.' },
      { title: 'Kubernetes-Security', text: 'Härtung und Betrieb in regulierten Umgebungen.' },
    ],
    formats: ['Vortrag', 'Workshop', 'Hackathon'],
    cta: 'Speaker anfragen',
    mailSubject: 'Speaker-Anfrage',
  },
  timeline: {
    id: 'werdegang',
    title: 'Werdegang',
    items: [
      { period: 'seit 2026', role: 'Freiberuflicher Plattformarchitekt', org: 'Thomas Tischner IT Systems', text: '' },
      {
        period: 'laufend',
        role: 'M.Sc. Applied Artificial Intelligence',
        org: 'IU Internationale Hochschule',
        text: 'Berufsbegleitendes Masterstudium.',
      },
      {
        period: '2020–2026',
        role: 'Architekt Big Data & AI Plattformen',
        org: 'SVA System Vertrieb Alexander GmbH',
        text: 'Daten-, KI- und Container-Plattformen in Kundenprojekten, mit fachlich-technischer Verantwortung.',
      },
      {
        period: '2018–2020',
        role: 'Senior System Engineer DevOps / Platform',
        org: 'Thomann Bits & Beats GmbH',
        text: 'Erste Kubernetes-Plattform des Unternehmens, hybrid on-prem und Google Cloud.',
      },
      {
        period: '2016–2017',
        role: 'Senior System Engineer DevOps',
        org: 'noris network AG',
        text: 'Betrieb und Automatisierung von 700+ VMs und einer frühen OpenShift-Plattform für eine Bank.',
      },
      {
        period: '2011–2016',
        role: 'Rechenzentrum, Support & Managed Services',
        org: 'IP Exchange GmbH / QSC AG',
        text: 'Vom Data-Center-Betrieb über 2nd-Level-Support zu Managed Services und Plattformprojekten.',
      },
      {
        period: '2008–2011',
        role: 'Ausbildung Fachinformatiker Systemintegration (IHK)',
        org: 'Netdiscounter GmbH',
        text: 'Bei einem Internet Service Provider, verkürzt um ein halbes Jahr.',
      },
    ],
  },
  tech: {
    id: 'technologien',
    title: 'Technologien',
    groups: [
      { group: 'Plattform', items: ['Kubernetes', 'OpenShift', 'Rancher (Fleet)', 'vSphere Tanzu', 'Harbor', 'Istio', 'Knative', 'Operator Framework (Go, Kopf)'] },
      { group: 'KI / Data', items: ['KServe', 'vLLM', 'MLflow', 'Feast', 'Airflow', 'Trino', 'MinIO', 'Confluent Kafka', 'NVIDIA GPU Operator'] },
      { group: 'GitOps / IaC', items: ['ArgoCD', 'Crossplane', 'Tekton', 'GitLab CI', 'GitHub Actions', 'Terraform', 'Ansible', 'Helm'] },
      { group: 'Security', items: ['HashiCorp Vault (PKI)', 'Sealed Secrets'] },
      { group: 'Observability', items: ['Prometheus', 'Grafana', 'Loki', 'ELK', 'Velero'] },
      { group: 'Infrastruktur', items: ['Linux (RHEL, SUSE, Debian, Ubuntu)', 'VMware', 'KVM', 'Azure', 'Google Cloud', 'AWS'] },
    ],
  },
  certs: {
    id: 'zertifizierungen',
    title: 'Zertifizierungen',
    note: 'Jahreszahl = Jahr des Erwerbs.',
    // Newest first within each category
    categories: [
      {
        name: 'KI',
        items: [
          { name: 'Claude Certified Architect – Foundations', issuer: 'Anthropic', year: '2026', url: 'https://www.credly.com/badges/c5e01331-f68f-4c7b-8fe2-5a6a7e7c9267' },
          { name: 'NVIDIA-Certified Associate: AI Infrastructure & Operations', issuer: 'NCA-AIIO', year: '2025' },
        ],
        extras: [
          {
            label: 'Kurse',
            items: [
              'Claude Code in Action (Anthropic, 2026)',
              'Introduction to Model Context Protocol (Anthropic, 2026)',
              'Claude with the Anthropic API (Anthropic, 2026)',
              'Introduction to Agent Skills (Anthropic, 2026)',
              'NVIDIA AI Infrastructure and Operations Fundamentals (2025)',
              'NVIDIA AI for All: From Basics to GenAI (2025)',
            ],
          },
        ],
      },
      {
        name: 'Kubernetes',
        note: 'CNCF / Linux Foundation',
        items: [
          { name: 'CKS – Certified Kubernetes Security Specialist', year: '2024' },
          { name: 'CKAD – Certified Kubernetes Application Developer', year: '2022' },
          { name: 'CKA – Certified Kubernetes Administrator', year: '2020' },
        ],
      },
      {
        name: 'Cloud & Plattform',
        items: [
          { name: 'Microsoft Certified: Azure Administrator Associate', issuer: 'AZ-104', year: '2026' },
          { name: 'Red Hat Certified Specialist in OpenShift Administration', year: '2019' },
          { name: 'Google Cloud Platform Fundamentals: Core Infrastructure', year: '2018' },
        ],
      },
      {
        name: 'IBM',
        items: [
          { name: 'IBM Certified Solution Architect – Cloud Pak for Integration', year: 'v2021.4' },
          { name: 'IBM Certified Administrator – Cloud Pak for Integration', year: 'V2021.2' },
          { name: 'IBM Certified Solution Architect – Cloud Pak for Integration', year: 'v2020.1' },
        ],
      },
      {
        name: 'Streaming',
        items: [
          { name: 'Confluent Cloud Operator', year: '2025' },
          { name: 'Confluent Learning Path Certificate', year: '2021' },
        ],
      },
      {
        name: 'Enterprise Architecture',
        items: [{ name: 'TOGAF® 9 Foundation', year: '2024' }],
      },
      {
        name: 'Netzwerk & Security',
        note: 'Cisco',
        items: [
          { name: 'Cisco CCNP Security', year: '2014' },
          { name: 'Cisco CCNA Security', year: '2013' },
          { name: 'Cisco CCNA Routing & Switching', year: '2013' },
        ],
        extras: [
          {
            label: 'Spezialisierungen (2014)',
            items: [
              'Cisco ASA Specialist',
              'Cisco VPN Security Specialist',
              'Cisco Firewall Security Specialist',
              'Cisco IOS Security Specialist',
              'Cisco IPS Specialist',
            ],
          },
          {
            label: 'NSA/CNSS-Anerkennung',
            items: ['CNSS 4013 (2014)', 'CNSS 4011 (2013)'],
          },
          {
            label: 'Trainings',
            items: [
              'FIREWALL (2014)',
              'SECURE (2014)',
              'Deploying Cisco ASA VPN Solutions (2014)',
              'IINS (2013)',
              'ICND1 (2012)',
              'ICND2 (2012)',
            ],
          },
          {
            label: 'Cisco Networking Academy',
            items: ['CCNA Discovery – Networking for Home and Small Businesses (2010)'],
          },
        ],
      },
      {
        name: 'Linux',
        items: [
          { name: 'LPIC-1 – Linux Professional Institute', year: '2013' },
          { name: 'SUSE/Novell Certified Linux Administrator (CLA)', year: '2013' },
        ],
      },
    ],
    other: {
      name: 'Weitere',
      items: [
        'English Certificate (2026)',
        'JSON Path – Course Completion (2020)',
        'Elektronisch unterwiesene Person (EUP, 2015)',
        'Projektmanagement Basic (2014)',
      ],
    },
  },
  product: {
    id: 'produkt',
    title: 'Eigenes Produkt',
    name: 'Holzbau-Konfigurator',
    text: 'B2B-Software für Zimmereien: 3D-Konfigurator mit Kalkulation, von der Anfrage bis zum Angebot. Entwickelt und betrieben von mir.',
    url: 'https://holzbau-konfigurator.de',
    linkLabel: 'holzbau-konfigurator.de',
  },
  contactSection: {
    id: 'kontakt',
    title: 'Kontakt',
    text: 'Sie planen eine Plattform oder wollen eine bestehende umbauen? Schreiben Sie mir kurz, worum es geht.',
    availability: 'Remote / DACH, projektweise vor Ort',
  },
  footer: {
    imprint: 'Impressum',
    privacy: 'Datenschutz',
  },
};

export type SiteContent = typeof de;

const enLabels: Record<string, string> = {
  KI: 'AI',
  'Cloud & Plattform': 'Cloud & Platform',
  'Netzwerk & Security': 'Network & Security',
  Kurse: 'Courses',
  'Spezialisierungen (2014)': 'Specializations (2014)',
  'NSA/CNSS-Anerkennung': 'NSA/CNSS recognition',
  Trainings: 'Training',
  Plattform: 'Platform',
  Infrastruktur: 'Infrastructure',
};
const tr = (label: string) => enLabels[label] ?? label;

const en: SiteContent = {
  meta: {
    title: 'Freelance Kubernetes Consultant & Architect | Thomas Tischner',
    description:
      'Freelance Kubernetes and platform architect from Nuremberg, Germany: OpenShift, Rancher, GitOps, AI and data platforms. CKS, CKA, CKAD. Remote across Germany, Austria and Switzerland.',
    ogAlt: 'Thomas Tischner, platform architect for Kubernetes and AI/data platforms',
  },
  ui: {
    skip: 'Skip to content',
    navLabel: 'Main navigation',
    legalLabel: 'Legal',
    langName: 'English',
    mailSubject: 'Project inquiry',
    externalHint: '(external website)',
    langLabel: 'Language',
    playGame: 'Play Kubernetes Invaders',
    playEgg: 'Easter egg: start Kubernetes Invaders',
    quoteOpen: '“',
    quoteClose: '”',
  },
  nav: [
    { href: '#profile', label: 'Profile' },
    { href: '#services', label: 'Services' },
    { href: '#projects', label: 'Projects' },
    { href: '#speaker', label: 'Speaker' },
    { href: '#career', label: 'Career' },
    { href: '#technologies', label: 'Stack' },
    { href: '#contact', label: 'Contact' },
  ],
  hero: {
    eyebrow: 'Freelance Kubernetes consultant · Nuremberg, Germany · Remote (DE, AT, CH)',
    name: 'Thomas Tischner',
    role: 'Platform Architect · Kubernetes & AI/Data Platforms',
    pitch: 'I turn complex infrastructure into scalable, automated platforms.',
    cta: 'Discuss a project',
    secondary: 'GitHub',
    badges: ['Claude Certified Architect', 'CKS · CKA · CKAD', 'M.Sc. Applied AI (in progress)'],
    badgesLabel: 'Credentials',
    portraitAlt: 'Portrait of Thomas Tischner',
    portraitOpen: 'Enlarge portrait',
    portraitClose: 'Close',
  },
  profile: {
    id: 'profile',
    title: 'Profile',
    lead: 'More than 15 years in IT, over five of them as an architect in consulting.',
    rest: 'I come from the data center and know the stack from hardware to model deployment.',
    stats: [
      { value: '15+', label: 'years in IT' },
      { value: '5+', label: 'years as an architect in consulting' },
    ],
    focusTitle: 'Focus areas',
    focus: [
      { title: 'Highly available multi-cluster platforms', text: 'Scalable and automated, from design to operations.' },
      { title: 'AI and data science platforms', text: 'So business teams can deliver their own use cases.' },
      { title: 'End-to-end automation', text: 'From provisioning to deployment, reproducible with GitOps.' },
    ],
    motto: 'Pragmatic, sustainable and built with operations in mind from day one.',
  },
  services: {
    id: 'services',
    title: 'Services',
    items: [
      {
        title: 'Kubernetes platforms',
        text: 'Multi-cluster platforms on OpenShift, Rancher or vSphere Tanzu, from planning to operations.',
      },
      {
        title: 'AI and data platforms',
        text: 'Model serving and LLM inference, feature store, GPU workloads and Kafka streaming for data science teams.',
      },
      {
        title: 'GitOps and automation',
        text: 'Infrastructure and deployments as code: ArgoCD, Crossplane, Tekton, Terraform, Ansible, Helm.',
      },
      {
        title: 'Security and operations',
        text: 'CKS-level hardening, Vault and PKI, service mesh, monitoring. Plus architecture reviews, workshops and hackathons, most recently on AI agents in platform operations.',
      },
    ],
  },
  projects: {
    id: 'projects',
    title: 'Projects',
    note: 'I don’t name clients, only the industry.',
    items: [
      {
        title: 'AI/data science platform',
        sector: 'Security-critical environment',
        period: '2024–2026',
        metrics: [
          { value: '~10', label: 'clusters' },
          { value: '9', label: 'nodes per cluster' },
          { value: '2', label: 'sites' },
        ],
        text: 'Multi-tenant platform in an isolated environment on vSphere Tanzu, GitOps with ArgoCD and Crossplane. Business teams run model serving, feature store, workflows and GPU jobs themselves.',
        stack: ['KServe', 'vLLM', 'Feast', 'MLflow', 'Airflow', 'Trino', 'NVIDIA GPU Operator'],
      },
      {
        title: 'Real-time streaming',
        sector: 'Vehicle manufacturing',
        period: '2023–2026',
        metrics: [{ value: '1–9 M', label: 'events per day' }],
        text: 'Confluent Kafka platform for safety-relevant production data, with separate Rancher clusters per stage and end-to-end monitoring. Deployments via Helm, Fleet and GitHub Actions.',
        stack: ['Confluent Kafka', 'Rancher', 'Fleet', 'Helm', 'GitHub Actions'],
      },
      {
        title: 'Streaming platform',
        sector: 'Public sector',
        period: '2021–2024',
        metrics: [
          { value: '~60%', label: 'faster deployments' },
          { value: '7', label: 'departments' },
        ],
        text: 'Multi-cluster OpenShift platform where departments deploy on their own via Git. CI/CD migrated from GitLab to Tekton, Istio introduced, secrets and PKI moved to Vault.',
        stack: ['OpenShift', 'Tekton', 'Istio', 'HashiCorp Vault', 'Kafka'],
      },
      {
        title: 'Kubernetes PaaS',
        sector: 'Public sector',
        period: '2020–2021',
        metrics: [
          { value: '~40', label: 'clusters' },
          { value: '~720', label: 'nodes' },
        ],
        text: 'Organization-wide Kubernetes platform on bare metal and VMs with fully automated provisioning.',
        stack: ['OpenShift', 'Ansible', 'VMware'],
      },
    ],
  },
  speaker: {
    id: 'speaker',
    title: 'Speaker',
    lead: 'In talks, workshops and hackathons I show how platforms and AI work together in practice.',
    rest: 'Concrete, accessible and drawn from real projects.',
    imageAlt: 'Thomas Tischner giving a talk on AI agents on stage',
    caption: 'Talk “What are AI agents?”',
    topicsTitle: 'Topics',
    topics: [
      { title: 'AI agents in practice', text: 'From chat to autonomous assistant: agents, tools, workflows and their value in platform operations.' },
      { title: 'AI and data platforms on Kubernetes', text: 'Model serving, LLM inference and self-service for data science teams.' },
      { title: 'Platform engineering and GitOps', text: 'How teams ship faster and more safely with automated platforms.' },
      { title: 'Kubernetes security', text: 'Hardening and operations in regulated environments.' },
    ],
    formats: ['Talk', 'Workshop', 'Hackathon'],
    cta: 'Book me as a speaker',
    mailSubject: 'Speaker inquiry',
  },
  timeline: {
    id: 'career',
    title: 'Career',
    items: [
      { period: 'since 2026', role: 'Freelance Platform Architect', org: 'Thomas Tischner IT Systems', text: '' },
      {
        period: 'in progress',
        role: 'M.Sc. Applied Artificial Intelligence',
        org: 'IU International University of Applied Sciences',
        text: 'Part-time master’s programme.',
      },
      {
        period: '2020–2026',
        role: 'Architect Big Data & AI Platforms',
        org: 'SVA System Vertrieb Alexander GmbH',
        text: 'Data, AI and container platforms in client projects, as technical lead.',
      },
      {
        period: '2018–2020',
        role: 'Senior System Engineer DevOps / Platform',
        org: 'Thomann Bits & Beats GmbH',
        text: 'The company’s first Kubernetes platform, hybrid on-prem and Google Cloud.',
      },
      {
        period: '2016–2017',
        role: 'Senior System Engineer DevOps',
        org: 'noris network AG',
        text: 'Operations and automation of 700+ VMs and an early OpenShift platform for a bank.',
      },
      {
        period: '2011–2016',
        role: 'Data Center, Support & Managed Services',
        org: 'IP Exchange GmbH / QSC AG',
        text: 'From data center operations through second-level support to managed services and platform projects.',
      },
      {
        period: '2008–2011',
        role: 'Apprenticeship: IT Specialist for System Integration (IHK)',
        org: 'Netdiscounter GmbH',
        text: 'At an internet service provider, completed six months early.',
      },
    ],
  },
  tech: {
    id: 'technologies',
    title: 'Technologies',
    groups: de.tech.groups.map((g) => ({ ...g, group: tr(g.group) })),
  },
  certs: {
    ...de.certs,
    id: 'certifications',
    title: 'Certifications',
    note: 'Year = year obtained.',
    categories: de.certs.categories.map((cat) => ({
      ...cat,
      name: tr(cat.name),
      extras: cat.extras?.map((x) => ({ ...x, label: tr(x.label) })),
    })),
    other: {
      name: 'Other',
      items: [
        'English Certificate (2026)',
        'JSON Path – Course Completion (2020)',
        'Electrically Instructed Person (EuP, 2015)',
        'Project Management Basic (2014)',
      ],
    },
  },
  product: {
    ...de.product,
    id: 'product',
    title: 'My product',
    text: 'B2B software for carpentry businesses: a 3D configurator with pricing, from inquiry to quote. Built and run by me.',
  },
  contactSection: {
    id: 'contact',
    title: 'Contact',
    text: 'Planning a platform or rebuilding an existing one? Send me a short note on what you need.',
    availability: 'Remote across Germany, Austria and Switzerland, on-site as needed',
  },
  footer: {
    imprint: 'Legal notice',
    privacy: 'Privacy',
  },
};

// Every language with content gets its own home page (src/pages/[lang]/index.astro).
export const content: Partial<Record<Lang, SiteContent>> = { de, en };

export const availableLangs = (Object.keys(content) as Lang[]).filter((l) => content[l]);

export function t(lang: Lang): SiteContent {
  const c = content[lang];
  if (!c) throw new Error(`No content for language "${lang}"`);
  return c;
}
