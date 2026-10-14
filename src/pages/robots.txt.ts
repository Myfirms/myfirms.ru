/** Mirrors BaseLayout's PUBLIC_LAUNCHED gate — pre-launch (and on the
 * Amplify preview) disallow everything; post-launch, the real rules.
 *
 * /ads-tool* (Google Ads API tool: home, privacy, terms) is the exception: Google's
 * OAuth / brand verification must be able to crawl it, so it is Allowed even
 * pre-launch (the longer `Allow` rule wins over `Disallow: /`). */
const SITE_LAUNCHED = import.meta.env.PUBLIC_LAUNCHED === 'true';

const body = SITE_LAUNCHED
  ? `User-agent: *
Disallow: /internal/
Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&gclid&fbclid

Sitemap: https://myfirms.ru/sitemap-index.xml
`
  : `User-agent: *
Allow: /ads-tool
Disallow: /
`;

export async function GET() {
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
