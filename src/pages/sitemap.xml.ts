// sitemap.xml: all pages with hreflang alternates (from the route table) plus blog articles.
import type { APIRoute } from 'astro';
import { routes, type Lang } from '../i18n/content';
import { getPosts, postUrl } from '../lib/blog';

const LANGS = Object.keys(routes) as Lang[];
const PAGES = Object.keys(routes.de) as (keyof typeof routes.de)[];

export const GET: APIRoute = async ({ site }) => {
  const url = (path: string) => new URL(path, site).href;
  const pages = PAGES.flatMap((page) =>
    LANGS.map((lang) => {
      const alternates = LANGS.map(
        (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${url(routes[l][page])}"/>`,
      ).join('\n');
      return `  <url>
    <loc>${url(routes[lang][page])}</loc>
${alternates}
    <xhtml:link rel="alternate" hreflang="x-default" href="${url(routes.de[page])}"/>
  </url>`;
    }),
  );
  // Articles are German only; lastmod reflects the article's own date, not the build date.
  const posts = (await getPosts()).map(
    (post) => `  <url>
    <loc>${url(postUrl(post))}</loc>
    <lastmod>${(post.data.updated ?? post.data.pubDate).toISOString().slice(0, 10)}</lastmod>
  </url>`,
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${[...pages, ...posts].join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
