/**
 * Request form contract — one payload for every form on the site (popup
 * "Оставить заявку", the "Готовы обсудить условия?" section, the case-study
 * form). The WP site had four Contact Form 7 forms with different field
 * names (sub/sub2/sub3/your-name/tel-87) and no personal-data consent —
 * both fixed here: one shape, and consent is required (152-ФЗ, ст. 9).
 */
export type RequestFormSource = 'popup' | 'section' | 'case-study';

export interface RequestFormPayload {
  name: string;
  phone: string;
  email?: string;
  message?: string;
  /** Must be true — the submit button stays disabled otherwise. */
  consent: true;
  /** Version of the consent text the visitor agreed to (legal/consent.md `updated`). */
  consentVersion: string;
  source: RequestFormSource;
  /** Page the form was submitted from (pathname). */
  page: string;
  /** Honeypot — must stay empty; bots fill it. */
  website?: string;
}

export type RequestFormSubmitResult = { status: 'ok' } | { status: 'error'; message: string };

export interface RequestFormFieldErrors {
  name?: string;
  phone?: string;
  email?: string;
  consent?: string;
}

const PHONE_DIGITS = /\d/g;

export function validateRequestForm(p: Partial<RequestFormPayload>, withEmail: boolean): RequestFormFieldErrors {
  const e: RequestFormFieldErrors = {};
  if (!p.name?.trim()) e.name = 'Укажите имя';
  const digits = (p.phone ?? '').match(PHONE_DIGITS)?.length ?? 0;
  if (digits < 10 || digits > 15) e.phone = 'Укажите телефон, например +7 900 000-00-00';
  if (withEmail && p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) e.email = 'Проверьте e-mail';
  if (!p.consent) e.consent = 'Нужно согласие на обработку персональных данных';
  return e;
}
