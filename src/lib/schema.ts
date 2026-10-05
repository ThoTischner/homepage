// Structured data (schema.org JSON-LD) for the home pages.
// Deliberately without email/phone: contact data stays protected (see protect.ts).
import { getImage } from 'astro:assets';
import portrait from '../assets/portrait.jpg';
import { t, contact, routes, type Lang } from '../i18n/content';

const KNOWS_ABOUT = [
  'Kubernetes',
  'OpenShift',
  'Rancher',
  'VMware vSphere Tanzu',
  'Platform Engineering',
  'GitOps',
  'ArgoCD',
  'Crossplane',
  'Tekton',
  'Terraform',
  'Ansible',
  'Helm',
  'Apache Kafka',
  'MLOps',
  'KServe',
  'vLLM',
  'LLM Inference',
  'AI Agents',
  'HashiCorp Vault',
  'Istio',
  'Kubernetes Security',
  'Observability',
  'Cloud Architecture',
];

export async function homeSchema(lang: Lang, site: URL) {
  const c = t(lang);
  const home = new URL(routes[lang].home, site).href;
  const person = new URL('/#person', site).href;
  const business = new URL('/#business', site).href;
  const image = await getImage({ src: portrait, width: 512, format: 'jpg' });
  const credly = c.certs.categories.flatMap((cat) => cat.items).find((i) => 'url' in i)?.url;

  const address = {
    '@type': 'PostalAddress',
    addressLocality: 'Nürnberg',
    addressRegion: 'Bayern',
    addressCountry: 'DE',
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': person,
        name: contact.name,
        givenName: 'Thomas',
        familyName: 'Tischner',
        jobTitle: c.hero.role,
        description: c.meta.description,
        url: home,
        image: new URL(image.src, site).href,
        address,
        worksFor: { '@id': business },
        knowsAbout: KNOWS_ABOUT,
        knowsLanguage: ['de', 'en'],
        sameAs: [contact.linkedin, contact.github, ...(credly ? [credly] : [])],
        hasCredential: c.certs.categories.flatMap((cat) =>
          cat.items.map((item) => ({
            '@type': 'EducationalOccupationalCredential',
            name: item.name,
            credentialCategory: 'certification',
          })),
        ),
      },
      {
        '@type': 'ProfessionalService',
        '@id': business,
        name: contact.company,
        url: home,
        image: new URL(`/og-${lang}.jpg`, site).href,
        description: c.meta.description,
        founder: { '@id': person },
        address,
        areaServed: ['Germany', 'Austria', 'Switzerland'].map((name) => ({ '@type': 'Country', name })),
        knowsAbout: KNOWS_ABOUT,
        sameAs: [contact.linkedin],
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: c.services.title,
          itemListElement: c.services.items.map((s) => ({
            '@type': 'Offer',
            itemOffered: { '@type': 'Service', name: s.title, description: s.text, provider: { '@id': business } },
          })),
        },
      },
      {
        '@type': 'WebSite',
        '@id': new URL('/#website', site).href,
        url: new URL('/', site).href,
        name: contact.company,
        inLanguage: ['de', 'en'],
        publisher: { '@id': business },
      },
    ],
  };
}
