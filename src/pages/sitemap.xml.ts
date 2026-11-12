// sitemap.xml: all pages in every language plus blog articles.
// Language alternates are declared via hreflang links in each page's <head>, not repeated here.
import type { APIRoute } from 'astro';
import { routes, type Lang } from '../i18n/content';
import { getPosts, postUrl } from '../lib/blog';

const LANGS = Object.keys(routes) as Lang[];
const PAGES = Object.keys(routes.de) as (keyof typeof routes.de)[];
// Last content change of the static pages: bump on changes so search engines recrawl them.
// Also applies to articles when shared parts (author box, layout) change.
const SITE_UPDATED = '2026-11-12';

export const GET: APIRoute = async ({ site }) => {
  const url = (path: string) => new URL(path, site).href;
  const pages = PAGES.flatMap((page) => LANGS.map((lang) => `  <url>\n    <loc>${url(routes[lang][page])}</loc>\n    <lastmod>${SITE_UPDATED}</lastmod>\n  </url>`));
  // lastmod: the article's own date, or the last site-wide change if that is newer (never the build date)
  const posts = (await getPosts()).map((post) => {
    const own = (post.data.updated ?? post.data.pubDate).toISOString().slice(0, 10);
    return `  <url>
    <loc>${url(postUrl(post))}</loc>
    <lastmod>${own > SITE_UPDATED ? own : SITE_UPDATED}</lastmod>
  </url>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...pages, ...posts].join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
