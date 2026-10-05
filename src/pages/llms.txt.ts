// llms.txt: concise, machine-readable overview for AI search and assistants (llmstxt.org).
import type { APIRoute } from 'astro';
import { t, contact, routes } from '../i18n/content';
import { getPosts, postUrl } from '../lib/blog';

export const GET: APIRoute = async ({ site }) => {
  const de = t('de');
  const en = t('en');
  const url = (path: string) => new URL(path, site).href;
  const posts = await getPosts();
  const certs = de.certs.categories.flatMap((cat) => cat.items.map((i) => i.name));

  const text = `# ${contact.company}

> ${en.meta.description}

${contact.name} is a freelance platform architect based in Nuremberg, Germany. He designs and builds Kubernetes, AI and data platforms for enterprises and public-sector organisations in Germany, Austria and Switzerland, including regulated and air-gapped environments. Remote across Germany, Austria and Switzerland, on-site as needed. Languages: German, English.

## Services

${en.services.items.map((s) => `- ${s.title}: ${s.text}`).join('\n')}

## Selected projects (clients anonymised)

${en.projects.items.map((p) => `- ${p.title} (${p.sector}, ${p.period}): ${p.text}`).join('\n')}

## Certifications

${certs.map((name) => `- ${name}`).join('\n')}

## Articles (German)

${posts.map((p) => `- [${p.data.title}](${url(postUrl(p))}): ${p.data.summary}`).join('\n')}

## Links

- [Website (German)](${url(routes.de.home)})
- [Website (English)](${url(routes.en.home)})
- [Contact](${url(routes.en.home)}#${en.contactSection.id})
- [LinkedIn](${contact.linkedin})
- [GitHub](${contact.github})
`;
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
