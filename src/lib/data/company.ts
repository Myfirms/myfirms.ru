/**
 * Company facts — the single source for the footer, Contacts page,
 * Organization JSON-LD and the personal-data policy. Requisites supplied by
 * the owner 2026-10-09 (the live WP site rendered an empty "Реквизиты" block).
 */
export const company = {
  brand: 'MyFirms',
  legalName: 'ООО «Майфирмс»',
  tagline: 'маркетинг и веб-разработка',
  ogrn: '1137154036194',
  ogrnDate: '20 ноября 2013 г.',
  registrationDate: '20.11.2013',
  inn: '7116511293',
  kpp: '711601001',
  address: {
    postalCode: '300028',
    region: 'Тульская область',
    locality: 'Тула',
    street: 'ул. Болдина, д. 98, офис 607',
    full: '300028, Тульская область, г. Тула, ул. Болдина, д. 98, офис 607',
    short: 'Тула, Болдина 98, офис 607',
  },
  email: 'info@myfirms.ru',
  /** Where form submissions are delivered (lambda/lead-intake). */
  leadsEmail: 'it@myfirms.ru',
  foundedYear: 2008,
  youtube: 'https://www.youtube.com/@myfirms',
} as const;
