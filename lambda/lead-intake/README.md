# lead-intake Lambda

Принимает заявки со всех форм myfirms.ru (попап, «Готовы обсудить условия?»,
форма на странице кейса) и отправляет письмо на `it@myfirms.ru` через Amazon SES.
Ничего не хранит. Разворачивается вручную через консоль AWS (не входит в сборку Astro),
по той же схеме, что `octopel-lead-intake`.

## 1. SES — подтвердить адрес

1. AWS console → **SES → Verified identities → Create identity**.
2. Тип: Email address, `it@myfirms.ru`. Регион — тот же, что у Octopel (например `us-west-2`).
3. Перейти по ссылке из письма, которое SES пришлёт на `it@myfirms.ru`.

Отправитель и получатель — один и тот же подтверждённый адрес, поэтому режим sandbox подходит,
запрашивать production access не нужно.

> Если письма попадают в спам на mail.ru: подтвердить в SES весь домен `myfirms.ru`
> (Create identity → Domain) и добавить в DNS Selectel три CNAME-записи DKIM, которые выдаст SES.
> MX/SPF почты mail.ru при этом **не трогать**.

## 2. Lambda — создать функцию

1. **Lambda → Create function** → Author from scratch, имя `myfirms-lead-intake`,
   runtime **Node.js 24.x**, architecture arm64.
2. Вставить содержимое `index.mjs` в редактор, **Deploy**.
   `npm install` не нужен — `@aws-sdk/client-sesv2` есть в рантайме.
3. **Configuration → General configuration**: Timeout = 10 сек. Переменные окружения не нужны: в коде по умолчанию
   получатель `it@myfirms.ru` и регион `us-west-2` (переопределяются `NOTIFY_EMAIL`, `FROM_EMAIL`, `SES_REGION`).
4. **Configuration → Permissions** → роль → **Add permissions → Create inline policy**:
   разрешить только `ses:SendEmail` (или прикрепить `AmazonSESFullAccess`).
5. **Configuration → Function URL → Create function URL**:
   - Auth type: **NONE**
   - CORS: allowed origins `https://myfirms.ru`, `https://www.myfirms.ru` и адрес превью
     Amplify (`https://main.xxxxxxxx.amplifyapp.com`); method `POST`; header `Content-Type`.
   - CORS-заголовки в коде **не** добавлять — Function URL ставит их сам.
6. Скопировать Function URL.

## 3. Amplify — подключить к сайту

**Amplify → приложение → Hosting → Environment variables**:
`PUBLIC_LEAD_ENDPOINT_URL` = Function URL из шага 2 → **Redeploy**.
Пока переменная не задана, формы честно показывают ошибку, а не «успех».

## 4. Проверка

Отправить заявку с превью Amplify → письмо должно прийти на `it@myfirms.ru`.
Логи: Lambda → Monitor → View CloudWatch logs.

## 152-ФЗ

Функция работает в AWS (США) — это трансграничная передача персональных данных.
Политика и текст согласия на сайте это описывают; до запуска нужно подать в Роскомнадзор
уведомление о трансграничной передаче (ст. 12 152-ФЗ) **или** перенести этот обработчик
в российское облако (Яндекс Облако Cloud Functions + SMTP mail.ru) — тогда поменять
только `PUBLIC_LEAD_ENDPOINT_URL`, код сайта не меняется.
