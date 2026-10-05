// RSS feed of all blog articles.
import type { APIRoute } from 'astro';
import { t } from '../../i18n/content';
import { getPosts, postUrl } from '../../lib/blog';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async ({ site }) => {
  const c = t('de');
  const posts = await getPosts();
  const url = (path: string) => new URL(path, site).href;
  const items = posts
    .map(
      (post) => `    <item>
      <title>${esc(post.data.title)}</title>
      <link>${url(postUrl(post))}</link>
      <guid isPermaLink="true">${url(postUrl(post))}</guid>
      <pubDate>${post.data.pubDate.toUTCString()}</pubDate>
      <description>${esc(post.data.description)}</description>
${post.data.tags.map((tag) => `      <category>${esc(tag)}</category>`).join('\n')}
    </item>`,
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Thomas Tischner – Blog</title>
    <link>${url('/blog/')}</link>
    <atom:link href="${url('/blog/rss.xml')}" rel="self" type="application/rss+xml"/>
    <description>${esc(c.blog.indexDescription)}</description>
    <language>de-DE</language>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
