/** Mirrors BaseLayout's PUBLIC_LAUNCHED gate — pre-launch (and on the
 * Amplify preview) disallow everything; post-launch, the real rules. */
const SITE_LAUNCHED = import.meta.env.PUBLIC_LAUNCHED === 'true';

const body = SITE_LAUNCHED
  ? `User-agent: *
Disallow: /internal/
Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&gclid&fbclid

Sitemap: https://myfirms.ru/sitemap-index.xml
`
  : `User-agent: *
Disallow: /
`;

export async function GET() {
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
