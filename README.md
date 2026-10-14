# MyFirms — сайт myfirms.ru

Статический сайт маркетингового агентства MyFirms на Astro. Перенесён с WordPress/Elementor
(Hetzner) 1:1 по адресам и текстам, хостинг — AWS Amplify. Архитектура повторяет проект
Octopel; решения — в [`docs/ARCHITECTURE_DECISIONS.md`](docs/ARCHITECTURE_DECISIONS.md),
план и статус переноса — в [`MIGRATION_PLAN.md`](MIGRATION_PLAN.md).

## Стек

- Astro 7 (static) + TypeScript strict, Node 24 LTS (`.node-version`), npm
- React только островами: форма заявки, попап, мобильное меню
- Чистый CSS: токены (`src/styles/tokens/`), scoped-стили, CSS Modules для React
- Content Collections (`src/content/`) за слоем `src/lib/repository/`
- Шрифты Roboto / Roboto Condensed — локально (`@fontsource`), иконки — `lucide-static` (inline SVG)

## Команды

| Команда | Что делает |
|---|---|
| `npm install` | Установить зависимости |
| `npm run dev` | Dev-сервер на `localhost:4321` |
| `npm run check` | Проверка TypeScript/Astro |
| `npm run build` | Сборка в `dist/` |
| `npm run preview` | Просмотр сборки |

Переменные окружения — [`.env.example`](.env.example). Без `PUBLIC_LAUNCHED=true` все страницы
`noindex`, robots.txt закрыт, счётчики не грузятся.

## Структура

```
src/
  content.config.ts        схемы: pages (блоки), portfolio, portfolioFilters, team, legal
  content/                 контент; _seo.json — title/description всех страниц
  components/astro/
    foundation/            Container, Section (фоны), Button, Breadcrumbs, Icon
    global/                Header, Footer, PageBanner, SubscribeBand, CookieNotice
    blocks/                Blocks.astro (switch) + Hero, Layout, ContactForm, Team, …
    widgets/               Widgets.astro (рекурсивный) + Title, Cards, Steps, Counters, …
    cards/, sections/      PortfolioCard, PortfolioListing
  components/react/        RequestForm, RequestFormDialog, NavMobile
  layouts/                 BaseLayout (meta, JSON-LD, счётчики), SiteLayout (шапка/футер)
  lib/                     contracts/, repository/, adapters/, analytics/, data/, tokens/
  pages/                   index, [...slug], [legal], portfolio/[...page],
                           portfolio-item/[slug], portfolio_filter/[slug], 404, robots.txt
  scripts/carousel.ts      общий скрипт каруселей (scroll-snap)
lambda/lead-intake/        приём заявок → письмо на it@myfirms.ru (SES)
deploy/                    редиректы и заметки по Amplify
migration/                 конвейер переноса с WordPress (см. ниже)
```

## Контент

Тело страницы — массив `blocks`. Повторяющиеся секции — семантические блоки (`hero`, `team`,
`contactForm`, `videoLesson`, `portfolio`, `lessons`, `requisites`); уникальные секции Elementor —
блок `layout`: ряды из колонок (12-колоночная сетка) с типизированными виджетами.
Картинки — пути внутри `src/assets/` (`wp/2022/01/02.jpg`), оптимизируются `astro:assets`.

## Перенос с WordPress (`migration/`)

```bash
cd migration && npm install
node scripts/crawl-inventory.mjs     # опись URL + SEO-база → url-inventory.csv
node scripts/extract-elementor.mjs   # дерево Elementor → extracted/*.json
node scripts/portfolio-filters.mjs   # рубрики кейсов
node scripts/download-media.mjs      # картинки → ../src/assets/wp/
node scripts/build-content.mjs       # → ../src/content/*, отчёт extracted/_report.md
```

Скрипты используют локальный Edge (puppeteer-core). `build-content.mjs` перезаписывает
сгенерированный контент — ручные правки контента после окончательного переноса делаются
уже в `src/content/`, а не в скриптах.
