# План переноса myfirms.ru: WordPress/Elementor (Hetzner) → Astro (AWS)

Статус: **черновик**, 2026-10-09. Архитектура берётся из `E:\Work\Octopel\Website`
(см. её `README.md` и `docs/ARCHITECTURE_DECISIONS.md`).

---

## 0. Что известно о текущем сайте

По Yoast-карте сайта (`/sitemap_index.xml`):

| Группа | URL | Что это |
|---|---|---|
| Страницы (`page`) | 22 | главная, `/marketing/` + 18 страниц услуг, `/o-kompanii/`, `/contacts/`, `/portfolio/` |
| Портфолио (`portfolio-item`) | 33 | кейсы клиентов |
| Фильтры портфолио (`portfolio_filter`) | 12 | архивы-рубрики кейсов по услугам |
| `em_case_study` | 6 | **похоже на демо-контент темы** (product-medicine, shopping-mohole…) |
| `em_brand` | 15 | **похоже на служебные записи темы** (логотипы площадок) |

Итого ~55 содержательных URL + ~33 технических.

⚠️ **SSL-сертификат myfirms.ru сейчас просрочен** (`SEC_E_CERT_EXPIRED`). Браузеры
показывают предупреждение, поисковики теряют доверие. Стоит продлить на Hetzner сразу
(certbot / панель), не дожидаясь переноса.

---

## Принятые решения (2026-10-09)

- Данные берутся с живого сайта скриптами (HTML + `/wp/v2/`), бэкап остаётся у владельца.
- Регистратор — domenus.ru; **DNS обслуживает Selectel** (ns1–4.selectel.ru); почта на mail.ru
  (MX `emx.mail.ru`) — при любых правках DNS MX/SPF/DKIM не трогать.
- AWS — тот же аккаунт, что у Octopel. GitHub-репозиторий создаёт владелец.
- Дизайн — **переносим текущий 1:1**, попутно чиним баги вёрстки; спорное — спрашиваем.
- Тексты — без изменений.
- Заявки — на `it@myfirms.ru`.
- `em_case_study/*`, `em_brand/*` — мусор темы, удаляем (410).
- Вебмастер / Search Console — настроим позже; интеграции — по ходу.

Результаты описи: `migration/url-inventory.csv` (88 URL, все 200), `migration/raw/` (кэш HTML),
`migration/uploads-referenced.txt` (335 файлов медиа).
SEO-проблемы старого сайта: **meta description нет ни на одной странице**, title = просто имя
страницы, **H1 нет на 54 страницах**, на 34 — от 2 до 4 H1.

---

## 1. Целевая архитектура (как в Octopel)

- **Astro** (текущая стабильная) + **TypeScript strict**, npm, Node 24 LTS
  (`.node-version` / `.nvmrc`).
- **React только островками** (`client:*`): шапка/мобильное меню, форма-попап,
  FAQ-аккордеон, фильтр портфолио, мобильная панель действий. Без SPA.
- **Чистый CSS**: токены на custom properties (`primitive → semantic → typography →
  spacing → effects → states → component`), scoped-стили в `.astro`, CSS Modules в React.
  Без Tailwind / CSS-in-JS / inline-стилей.
- **Content Collections** (JSON/MD в `src/content/`, Zod-схемы) за
  **repository/adapter-слоем** (`src/lib/repository/`) — CMS можно подключить позже,
  не трогая шаблоны.
- **Контракты** в `src/lib/contracts/`: breadcrumbs (+ JSON-LD), requestForm (одна схема
  для формы контактов и попапа), stickyActionBar.
- **Feature flags** (`PUBLIC_LAUNCHED` → noindex + закрытый robots до запуска).
- `docs/ARCHITECTURE_DECISIONS.md`, `README.md`, `CLAUDE.md`, `.claude/launch.json`.
- **Хостинг**: AWS Amplify Hosting (SSG, автодеплой из GitHub по push, env-переменные
  в Amplify), домен + ACM-сертификат через Amplify.
- **Формы**: отдельная Lambda (`lambda/lead-intake/`) с Function URL → e-mail (SES) и/или
  Telegram/CRM. Деплой вручную, как в Octopel.
- **Репозиторий**: GitHub `Myfirms/myfirms-website` (по аналогии с `Myfirms/octopel-website`).

Структура:

```
src/
  content.config.ts      коллекции: pages, services, serviceCategories, portfolio,
                         portfolioFilters, reviews, faqs, team, legal
  content/               данные, выгруженные из WP
  components/astro/      foundation/, global/, sections/, cards/
  components/react/      острова
  layouts/               BaseLayout, InternalLayout
  lib/                   contracts/, repository/, adapters/, analytics/, data/, tokens/
  pages/                 index, marketing/[...slug], portfolio-item/[slug], portfolio/,
                         o-kompanii, contacts, legal/[slug], robots.txt.ts
  styles/                global.css, tokens/*.css
lambda/lead-intake/
scripts/                 wp-export, image-import, redirects-check, link-check
docs/
```

---

## 2. Этапы

### Этап 1. Инвентаризация и бэкап (до любых изменений)
1. Полный бэкап с Hetzner: файлы + дамп БД (хранить вне репозитория).
2. Краулинг всех URL: статус, title, description, H1, canonical, внутренние ссылки
   → `docs/seo/url-inventory.csv` (это же — эталон для проверки после переноса).
3. Скриншоты всех шаблонов (десктоп/мобайл) — визуальный эталон.
4. Опись интеграций: формы (куда уходят заявки), Яндекс.Метрика/GA, коды верификации,
   виджеты (чат, коллтрекинг), пиксели.
5. Снять SEO-базу: Яндекс.Вебмастер + Search Console — топ-страницы, запросы,
   внешние ссылки (Ahrefs подключён — могу снять беклинки сам).

### Этап 2. Решения по URL и составу
- **Сохраняем все содержательные URL 1:1** (включая слэш на конце —
  `trailingSlash: 'always'`), чтобы не терять позиции.
- `em_case_study/*`, `em_brand/*` — удалить (410 или 301 на `/portfolio/`), если
  подтвердится, что это мусор темы.
- `portfolio_filter/*` — либо оставить как страницы-рубрики, либо 301 на
  `/portfolio/?filter=…` (решаем по трафику).
- Таблица редиректов → `docs/seo/redirects.csv` → правила Amplify.

### Этап 3. Каркас проекта
- `npm create astro`, TS strict, `@astrojs/react`, `@astrojs/sitemap`; git + GitHub.
- Токены, глобальные стили, BaseLayout (lang="ru", meta, OG, noindex-флаг),
  repository-слой, контракты, internal-страница `/internal/foundation`.
- `CLAUDE.md` с правилами проекта для Claude Code.

### Этап 4. Выгрузка контента из WordPress
- Скрипт `scripts/wp-export.mjs` через WP REST API (`/wp-json/wp/v2/pages`,
  `portfolio`, таксономии) + Yoast `yoast_head_json` (title/description/OG).
- Очистка Elementor-разметки → структурированный JSON по секциям (не HTML-каша).
- Медиа: скачать всё используемое, оптимизировать (sharp → AVIF/WebP, `astro:assets`),
  неиспользуемое не переносить.
- Отчёт по каждой странице: что извлечено автоматически, что требует ручной правки.

### Этап 5. Дизайн и шаблоны
Шаблоны: Главная · Категория услуг (`/marketing/`) · Страница услуги · Портфолио
(список + фильтр) · Кейс · О компании · Контакты · Юридические страницы · 404.
Дизайн — по вашему решению (см. «Вопросы»): перенос текущего 1:1 или новый дизайн-систем
по модели Octopel (Figma подключён).

### Этап 6. Формы и заявки
- Одна схема заявки для попапа и страницы контактов.
- Lambda: валидация, антиспам (honeypot + rate-limit), отправка на e-mail/Telegram/CRM,
  резервный e-mail при сбое — заявка не теряется.
- **152-ФЗ**: согласие на обработку ПДн, политика конфиденциальности; см. риски.

### Этап 7. SEO и аналитика
- title/description/H1/canonical перенесены из Yoast 1:1.
- sitemap.xml, robots.txt (с `Host`/`Clean-param` для Яндекса), schema.org
  (Organization, Service, BreadcrumbList, FAQPage).
- Яндекс.Метрика (цели на формы/телефон/мессенджеры), GA4 при необходимости.
- Cookie/ПДн-уведомление.

### Этап 8. Инфраструктура AWS
- Amplify app ← GitHub, ветки `main` (прод) и `dev` (превью на `*.amplifyapp.com`, noindex).
- Редиректы и заголовки (кэш, безопасность) в Amplify.
- Lambda + SES (или Telegram Bot API) для заявок.

### Этап 9. QA перед запуском
- Все URL из инвентаря: 200 или ожидаемый 301; битые ссылки — 0.
- Сравнение meta со старым сайтом (скрипт по `url-inventory.csv`).
- Lighthouse (цель 90+ мобайл), валидность разметки, доступность.
- **Проверка доступности из России** (несколько провайдеров/мобильные сети).
- Тестовые заявки end-to-end.

### Этап 10. Переключение
1. Снизить TTL DNS за 1–2 дня.
2. `PUBLIC_LAUNCHED=true`, привязать домен в Amplify, переключить DNS.
3. Яндекс.Вебмастер / GSC: новая карта сайта, переобход, мониторинг ошибок 2–4 недели.
4. Hetzner держать 1–2 месяца как откат, затем отключить.

---

## 3. Риски

| Риск | Что делаем |
|---|---|
| **Доступность AWS из РФ** (замедления/блокировки зарубежных CDN и IP-диапазонов со стороны РКН) | Тест из РФ до запуска; мониторинг; план Б — российский хостинг/CDN для статики (Astro-сборка переносима куда угодно) |
| **152-ФЗ: локализация ПДн** — заявки граждан РФ первично должны записываться в БД в РФ; трансграничная передача требует уведомления РКН | Не хранить ПДн в AWS; Lambda только пересылает в российскую CRM/почту, либо форма шлёт напрямую в CRM в РФ. Нужна юр. проверка с вашей стороны |
| Потеря позиций в Яндексе при смене URL/контента | URL 1:1, meta 1:1, 301 на всё удалённое, контроль в Вебмастере |
| Elementor-разметка плохо парсится | Полуавтомат: скрипт + ручная доводка, отчёт по каждой странице |
| Скрытые зависимости (виджеты, коллтрекинг) | Опись на этапе 1 |

---

## Статус на 2026-10-09 (точка остановки)

**Готово:** каркас Astro (как Octopel), токены, шапка/футер/баннер/полоса YouTube, форма заявки
(попап + секция, обязательное согласие на ПДн), все 22 страницы, 33 кейса, 12 рубрик, портфолио
с пагинацией, реквизиты, юр. страницы (политика ПДн, согласие, оферта — нужна проверка юристом),
404, robots, sitemap. Сборка: 74 страницы. Конвейер миграции: `migration/scripts/*`
(crawl → extract-elementor → download-media → build-content), отчёт `migration/extracted/_report.md`.

**Дальше:**
1. Lambda `lambda/lead-intake` (SES → it@myfirms.ru) + `PUBLIC_LEAD_ENDPOINT_URL` в Amplify — сейчас формы показывают ошибку.
2. SEO title/description для всех страниц → `src/content/_seo.json`, затем `node scripts/build-content.mjs`.
3. Проверка мобильной вёрстки, страницы услуг, О компании, Контакты, кейсы — сверка со старыми скриншотами.
4. Редиректы в Amplify (em_* , author, пустые рубрики, /veb-analitika/).
5. `astro check`, README, docs/ARCHITECTURE_DECISIONS.md, CLAUDE.md.

**Открытые вопросы владельцу:** иконки Flaticon → Lucide (ок?); декоративные «летающие» фигуры
темы убраны (кроме героя); ссылки на видео для карточек «Смотреть видео»; 4 сотрудника с разными
должностями на разных страницах (оставлено как на WP); 152-ФЗ — трансграничная передача через AWS
(уведомление РКН) или обработчик форм в Яндекс.Облаке.
