// Blog helpers: post list, reading time, Open Graph image and structured data.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getCollection, type CollectionEntry } from 'astro:content';
import { t, contact, routes } from '../i18n/content';

export type Post = CollectionEntry<'blog'>;

export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

export const postUrl = (post: Post) => `/blog/${post.id}/`;

/** Reading time in minutes, based on prose only (code blocks excluded). */
export function readingTime(body = ''): number {
  const prose = body.replace(/```[\s\S]*?```/g, ' ');
  const words = prose.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Per-article preview image if present (public/og/blog/<slug>.jpg), otherwise the site default. */
export function ogImagePath(post: Post): string {
  const own = `/og/blog/${post.id}.jpg`;
  // Resolved against the project root: import.meta.url points into the build output at build time
  return existsSync(join(process.cwd(), 'public', own)) ? own : '/og-de.jpg';
}

export const formatDate = (date: Date, lang: 'de' | 'en' = 'de') =>
  date.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function articleSchema(post: Post, site: URL) {
  const c = t('de');
  const url = new URL(postUrl(post), site).href;
  const person = new URL('/#person', site).href;
  const business = new URL('/#business', site).href;
  const { title, description, pubDate, updated, tags, faq } = post.data;

  const graph: object[] = [
    {
      '@type': 'TechArticle',
      '@id': `${url}#article`,
      headline: title,
      description,
      url,
      mainEntityOfPage: url,
      inLanguage: 'de',
      datePublished: pubDate.toISOString(),
      dateModified: (updated ?? pubDate).toISOString(),
      keywords: tags.join(', '),
      image: new URL(ogImagePath(post), site).href,
      author: { '@id': person, '@type': 'Person', name: contact.name, url: new URL('/', site).href },
      publisher: { '@id': business },
      isPartOf: { '@id': new URL('/#website', site).href },
      wordCount: (post.body ?? '').split(/\s+/).filter(Boolean).length,
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: c.blog.breadcrumbHome, item: new URL('/', site).href },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: new URL(routes.de.blog, site).href },
        { '@type': 'ListItem', position: 3, name: title, item: url },
      ],
    },
  ];

  if (faq.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: faq.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}
