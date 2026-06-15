# Tarot Telegram Bot

Telegram-бот: таро-расклады и натальные карты с AI-интерпретацией.

## Архитектура

```
пользователь
   │
   ▼
Telegram бот (grammY) ──── «Таро» ──► вопрос текстом ──► рандом 3 карт (crypto)
   │                                                          │
   │                                                          ▼
   └── «Натальная карта» ──► Mini App (React)          AI (DeepSeek/Gemini)
                                  │                           │
                                  ▼                           ▼
                       POST /api/natal (Fastify)      ответ в чат + фото карт
                       проверка initData (HMAC)
                                  │
                                  ▼
                  circular-natal-horoscope-js (расчёт позиций)
                                  │
                                  ▼
                       AI-интерпретация ──► сообщение в чат
```

Ключевые принципы:
- **AI-ключи только на сервере.** Фронтенд не знает о существовании AI API.
  Никаких `VITE_*` секретов — всё, что попадает в бандл, видно любому.
- **Рандом и астрономия — код, интерпретация — модель.** ИИ не «тянет карты»
  и не считает планеты, он получает готовые данные и пишет текст.
- **Ограничение модели — system-промпт + шаблон запроса** (`src/services/prompts.ts`).
  Пользовательский ввод попадает только внутрь нашего шаблона. MCP здесь не нужен.
- **Аутентификация mini app — подпись Telegram initData**, с проверкой
  свежести `auth_date`. Без неё API можно дёргать напрямую и жечь токены.

## Запуск (дев)

```bash
npm install
cp .env.example .env   # заполнить BOT_TOKEN, AI_API_KEY и т.д.

npm run dev:bot        # бот (long polling) + API на :3000
npm run dev:webapp     # mini app на :5173
```

Для кнопки Mini App нужен https — в деве подними туннель:
`cloudflared tunnel --url http://localhost:5173` и впиши URL в `WEBAPP_URL`.

Картинки карт: см. `scripts/fetch-card-images.md`.

## Платные запросы (следующий шаг)

Каждому пользователю даётся 3 кредита (`db.ts`). Когда `spendCredit()`
возвращает `false` — показываем пейволл. Для цифровых товаров в ботах
Telegram требует **Telegram Stars** (XTR):

```ts
await ctx.replyWithInvoice(
  '5 раскладов', 'Пакет из 5 запросов к картам',
  'credits_5',          // payload
  'XTR',                // валюта Stars, provider_token не нужен
  [{ label: '5 раскладов', amount: 50 }], // 50 Stars
);

bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));
bot.on('message:successful_payment', (ctx) => {
  addCredits(ctx.from.id, 5);
});
```

## Прод и масштабирование

- Long polling → **webhook** (`bot.api.setWebhook`, grammY `webhookCallback`
  монтируется прямо в Fastify) — один процесс, ноль лишней инфры.
- SQLite → Postgres, когда появится второй инстанс.
- Очередь (BullMQ) для AI-запросов, если упрёшься в rate limit провайдера.
- Раздавай собранный webapp статикой с того же Fastify — один домен, нет CORS.

## Структура

```
apps/bot/        grammY бот + Fastify API + сервисы (AI, таро, наталка)
apps/webapp/     Telegram Mini App: React + Vite + Tailwind v4
packages/shared/ общие TypeScript-типы (контракты API)
```
