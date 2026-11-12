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

${contact.name} (${contact.company}) is a freelance IT architect and engineer based in Nuremberg, Germany, with more than 15 years in IT: from data center operations (servers, networking, storage, backup) through virtualization and automation to Kubernetes since 2016 and today data and AI platforms. He covers the whole stack, from a single Linux server to multi-cluster Kubernetes platforms and AI and data platforms, for enterprises and public-sector organisations in Germany, Austria and Switzerland, including regulated and air-gapped environments. He can own the whole stack or take on a specific specialist role: as architect, engineer or reinforcement for a team.

## Key facts

- Role: ${en.meta.jobTitle}, freelance, company "${contact.company}"
- Location: Nuremberg, Germany. Works remote across Germany, Austria and Switzerland, on-site as needed (hybrid)
- Experience: ${en.profile.stats.map((s) => `${s.value} ${s.label}`).join(', ')}
- Key certifications: ${en.hero.badges.join(', ')}
- Availability: on request
- Languages: German, English

## How he works (in his own words)

${en.principles.items.map((p) => `- ${p.title}: ${p.text}`).join('\n')}

## Services

In his own words: ${en.services.intro}

${en.services.items.map((s) => `- ${s.title} layer: ${s.blocks.map((b) => b.name).join(', ')}`).join('\n')}
- Cross-cutting: ${en.services.pillars.join(', ')}
- Serves: ${en.services.users.map((u) => `${u.name} (${u.text})`).join('; ')}
- ${en.services.acrossLabel}: ${en.services.across.map((r) => r.title).join(', ')}

## Technologies

${en.tech.groups.map((g) => `- ${g.group}: ${g.items.join(', ')}`).join('\n')}

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
