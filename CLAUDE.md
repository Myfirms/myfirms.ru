# CLAUDE.md — myfirms.ru

Русскоязычный сайт маркетингового агентства MyFirms (ООО «Майфирмс»). Astro static → AWS Amplify.
Архитектура как у `E:\Work\Octopel\Website`. Общение с владельцем — по-русски.

## Перед работой

- Прочитать `docs/ARCHITECTURE_DECISIONS.md`; статус и открытые задачи — конец `MIGRATION_PLAN.md`.
- После изменений: `npm run check` (0 errors/warnings) и `npm run build`.

## Правила

- Данные — только через `src/lib/repository/`; `astro:content` импортирует лишь `contentCollectionRepository.ts`.
- Стили — токены из `src/styles/tokens/`; без Tailwind, CSS-in-JS и React `style={{}}`.
  Inline `style="--var: …"` допустим только для по-экземплярных значений (фон секции, span колонки).
- React — только для состояния на клиенте (формы, меню). Остальное — `.astro`.
- Брейкпоинты: 640 / 768 / 1024 (меню) / 1200; в JS — `lib/tokens/breakpoints.ts`.
- URL не менять: они перенесены с WordPress 1:1 (слэш на конце). Новый URL → редирект в `deploy/amplify-redirects.json`.
- Тексты страниц не переписывать без запроса владельца. SEO-мета — `src/content/_seo.json`.
- Реквизиты/контакты — только `src/lib/data/company.ts`.
- Формы: согласие на ПДн обязательно; при изменении текста согласия — обновить `updated`
  в `src/content/legal/soglasie-…md` и `CONSENT_VERSION` в `src/lib/data/legal.ts`.
- DNS у Selectel, почта на mail.ru: записи MX/SPF/DKIM не трогать.
- Деплой — push в `main` (Amplify собирает сам). Lambda и настройки Amplify — вручную в консоли AWS.

## Экономия токенов

Сырые данные старого сайта (`migration/raw/`) не читать целиком — обрабатывать скриптами
и выводить только сводки. Скриншоты — `migration/scripts/shots.mjs` (локальный Edge),
`ORIGIN=http://localhost:<port>` для нового сайта.
