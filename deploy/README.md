# Деплой на AWS Amplify

Сборка — `amplify.yml` (Node 24, `npm ci`, `npm run build`, артефакт `dist/`).
Заголовки — `customHttp.yml` в корне (применяются автоматически).

## Редиректы (вручную, один раз)

Amplify → приложение → **Hosting → Rewrites and redirects → Manage redirects → Open text editor**,
вставить содержимое [`amplify-redirects.json`](amplify-redirects.json), **Save**.

Последнее правило (`/<*>` → `/404.html`, статус 404) должно оставаться последним: оно отдаёт
нашу страницу 404 с кодом 404 для всех неизвестных адресов.

Что закрывают правила: мусор темы WP (`/em_case_study/`, `/em_brand/`, `/em_portfolios/`),
`/author/admin/`, пустые рубрики портфолио, битую ссылку `/veb-analitika/`, RSS и старые
карты сайта Yoast.

## Переменные окружения

См. `.env.example`. На превью задать только `PUBLIC_LEAD_ENDPOINT_URL`.
`PUBLIC_LAUNCHED=true` — только в день переключения DNS.

## Переключение домена (этап 10 плана)

1. Amplify → **Hosting → Custom domains → Add domain** → `myfirms.ru` (+ `www` → редирект на apex).
2. Amplify покажет CNAME-записи: проверку сертификата ACM и записи для `myfirms.ru` / `www`.
   Добавить их в DNS **Selectel** (ns1–4.selectel.ru). Для корня домена Selectel должен поддерживать
   ALIAS/ANAME; если нет — перенести зону в Route 53 и **сначала** перенести туда MX/SPF/DKIM почты mail.ru.
3. Записи MX, SPF, DKIM почты **не трогать**.
4. После выпуска сертификата: `PUBLIC_LAUNCHED=true` → Redeploy.
