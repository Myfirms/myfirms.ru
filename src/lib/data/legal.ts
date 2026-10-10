/** Legal page URLs — referenced by the footer, forms and the cookie notice. */
export const legalLinks = {
  privacy: '/politika-obrabotki-personalnyh-dannyh/',
  consent: '/soglasie-na-obrabotku-personalnyh-dannyh/',
  offer: '/publichnaya-oferta/',
  requisites: '/contacts/#rekvizity',
} as const;

/** Bump together with the consent page's `updated` when the consent text changes. */
export const CONSENT_VERSION = '2026-10-09';
