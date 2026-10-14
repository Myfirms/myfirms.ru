# Architecture Decisions

Status: **accepted**, 2026-10-09 — 2026-10-14. Базовая архитектура взята из проекта Octopel
(`E:\Work\Octopel\Website\docs\ARCHITECTURE_DECISIONS.md`); ниже — то, что специфично для
myfirms.ru, и отличия.

## 1. Стек (как Octopel)

Astro (static) + TypeScript strict, React только островами, чистый CSS на токенах
(primitive → semantic → typography → spacing → effects → states → component), Content
Collections за слоем `lib/repository/` (только он импортирует `astro:content`), контракты
в `lib/contracts/`. Хостинг — AWS Amplify, заявки — отдельная Lambda (`lambda/lead-intake`).

## 2. Перенос 1:1

- **URL** — как на WordPress, со слэшем на конце (`trailingSlash: 'always'`), включая
  `/portfolio/2/`, `/portfolio-item/…`, `/portfolio_filter/…`. Мусор темы (`em_*`, `author`)
  и пустые рубрики — 301 (`deploy/amplify-redirects.json`).
- **Тексты** — без изменений. **SEO** — по решению владельца переписаны title/description
  (`src/content/_seo.json`) и приведено к одному H1 на страницу (H1 — в баннере или в герое).
- **Дизайн** — текущий, с исправлением багов вёрстки (список — `migration/extracted/_report.md`
  и `MIGRATION_PLAN.md`).

## 3. Модель контента: блоки + универсальный layout

Страницы Elementor собраны вручную из 60+ разных комбинаций виджетов, поэтому шаблон на
страницу не подходит. Тело страницы — `blocks[]`:

- семантические блоки для повторяющихся секций: `hero`, `contactForm`, `team`, `videoLesson`,
  `portfolio`, `lessons`, `requisites`;
- `layout` для уникальных секций: ряды колонок (12-колоночная сетка) с типизированными
  виджетами (`title`, `text`, `cards`, `steps`, `process`, `counters`, `progress`, `list`,
  `quote`, `video`, `tabs`, `slides`, `carousel`, `image`, вложенный `row`).

Любой `layout` можно позже превратить в семантический блок, не трогая остальные страницы:
рендер — один switch в `components/astro/blocks/Blocks.astro`.

## 4. Формы заявок

- Одна схема (`lib/contracts/requestForm.ts`) для попапа, секции и формы кейса (на WP было
  4 формы CF7 с разными полями).
- **Обязательное согласие на обработку ПДн** (152-ФЗ) — отдельный документ согласия
  (требование с 01.09.2025), версия согласия передаётся с заявкой.
- Любой элемент с `data-request-form` открывает попап — так все кнопки WP с `href="#"`
  стали рабочими без React-обёрток.
- Honeypot против ботов; при незаданном `PUBLIC_LEAD_ENDPOINT_URL` форма честно показывает ошибку.

## 5. Отказ от WP-плагинов

Revolution Slider, Swiper, Slick, Owl → один скрипт `src/scripts/carousel.ts` на CSS scroll-snap
(работает и без JS). Шрифт иконок Flaticon → `lucide-static` (inline SVG, ближайшие аналоги).
Google Fonts → локальные `@fontsource` (быстрее и надёжнее из РФ). Видео YouTube — превью,
iframe `youtube-nocookie` грузится по клику. Поиск по сайту из шапки убран.

## 6. Аналитика и запуск

Метрика 97147329 и GA4 G-KPNZ32WW2F (как на WP) подключаются только при `PUBLIC_LAUNCHED=true` —
превью Amplify не индексируется и не портит статистику. Цели: `lead_form_open`, `lead_submit`,
`youtube_click` (`lib/analytics/track.ts`).

## 7. Открытые вопросы

- 152-ФЗ: Lambda в AWS = трансграничная передача (уведомление РКН) или обработчик в Яндекс Облаке.
- Иконки Lucide вместо Flaticon, удалённые декоративные фигуры темы — ждут подтверждения.
- Ссылки на ролики для карточек «Смотреть видео» (пока ведут на канал).
- Юридические тексты — шаблоны, нужна проверка юристом.
