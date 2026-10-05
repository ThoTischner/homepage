// Keeps contact data away from naive scrapers.
// - Text is emitted as HTML character references: readable for browsers and screen readers
//   (also without JS), but not as plain text in the source.
// - mailto:/tel: targets are Base64-encoded in data-href and applied client-side.

export const entities = (text: string) =>
  [...text].map((ch) => `&#${ch.codePointAt(0)};`).join('');

export const encodeHref = (href: string) => Buffer.from(href, 'utf8').toString('base64');
