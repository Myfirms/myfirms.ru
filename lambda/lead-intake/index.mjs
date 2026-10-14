import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

// Receives request-form submissions from myfirms.ru (payload shape:
// src/lib/contracts/requestForm.ts) and emails them to the leads inbox.
//
// Environment variables (set in the Lambda console, never in source):
//   NOTIFY_EMAIL  — recipient, defaults to it@myfirms.ru.
//   FROM_EMAIL    — SES-verified sender, defaults to NOTIFY_EMAIL.
//   SES_REGION    — AWS region the SES identity was verified in.
//
// CORS is configured on the Function URL itself (Configuration -> Function
// URL -> CORS), not here: the Function URL adds Access-Control-Allow-* to
// every response and answers the OPTIONS preflight before the handler runs.
// Setting the same headers in code duplicates them and browsers reject that.
//
// Nothing is stored here — the lead only passes through to the mailbox
// (see the 152-ФЗ note in README.md).
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'it@myfirms.ru';
const FROM_EMAIL = process.env.FROM_EMAIL || NOTIFY_EMAIL;
const SES_REGION = process.env.SES_REGION || 'us-west-2';

const ses = new SESv2Client({ region: SES_REGION });

const SOURCES = { popup: 'Попап «Оставьте заявку»', section: 'Форма «Готовы обсудить условия?»', 'case-study': 'Форма на странице кейса' };
const MAX = { name: 120, phone: 40, email: 200, message: 4000, page: 300 };

function jsonResponse(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max) : '');
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function parse(event) {
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '';
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export const handler = async (event) => {
  if (event.requestContext?.http?.method && event.requestContext.http.method !== 'POST') {
    return jsonResponse(405, { status: 'error', message: 'Method not allowed' });
  }
  const p = parse(event);
  if (!p) return jsonResponse(400, { status: 'error', message: 'Invalid JSON' });

  // Honeypot: bots fill the hidden "website" field. Pretend success so they don't retry.
  if (p.website) return jsonResponse(200, { status: 'ok' });

  const lead = {
    name: clean(p.name, MAX.name),
    phone: clean(p.phone, MAX.phone),
    email: clean(p.email, MAX.email),
    message: clean(p.message, MAX.message),
    page: clean(p.page, MAX.page),
    source: SOURCES[p.source] ?? 'Форма на сайте',
    consentVersion: clean(p.consentVersion, 20),
  };
  const digits = lead.phone.replace(/\D/g, '').length;
  if (!lead.name || digits < 10 || digits > 15 || p.consent !== true) {
    return jsonResponse(400, { status: 'error', message: 'Проверьте имя, телефон и согласие на обработку данных.' });
  }

  const received = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  const rows = [
    ['Имя', lead.name],
    ['Телефон', lead.phone],
    ['E-mail', lead.email],
    ['Задача', lead.message],
    ['Форма', lead.source],
    ['Страница', lead.page ? `https://myfirms.ru${lead.page}` : ''],
    ['Согласие на обработку ПДн', `дано (редакция ${lead.consentVersion || '—'})`],
    ['Получено', `${received} МСК`],
  ].filter(([, v]) => v);

  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  const html = `<table cellpadding="6" style="border-collapse:collapse;font:14px Arial,sans-serif">${rows
    .map(([k, v]) => `<tr><td style="color:#666;vertical-align:top">${k}</td><td>${escapeHtml(v).replace(/\n/g, '<br>')}</td></tr>`)
    .join('')}</table>`;

  try {
    await ses.send(
      new SendEmailCommand({
        // ASCII display name: SES requires RFC 2047 encoding for non-ASCII ones.
        FromEmailAddress: `MyFirms Website <${FROM_EMAIL}>`,
        Destination: { ToAddresses: [NOTIFY_EMAIL] },
        ReplyToAddresses: lead.email ? [lead.email] : undefined,
        Content: {
          Simple: {
            Subject: { Data: `Заявка с сайта: ${lead.name}, ${lead.phone}`, Charset: 'UTF-8' },
            Body: { Text: { Data: text, Charset: 'UTF-8' }, Html: { Data: html, Charset: 'UTF-8' } },
          },
        },
      }),
    );
  } catch (err) {
    console.error('SES send failed', err);
    return jsonResponse(502, { status: 'error', message: 'Не удалось отправить заявку.' });
  }

  return jsonResponse(200, { status: 'ok' });
};
