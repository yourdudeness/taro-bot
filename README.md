# Tarot Telegram Bot

Telegram-бот: таро-расклады и натальные карты с AI-интерпретацией.

## Запуск (дев)

```bash
npm install
cp .env.example .env   # заполнить BOT_TOKEN, AI_API_KEY и т.д.

npm run dev:bot        # бот (long polling) + API на :3000
npm run dev:webapp     # mini app на :5173
```

## Платные запросы (следующий шаг)

Каждому пользователю даётся 3 кредита (`db.ts`). Когда `spendCredit()`
возвращает `false` — показываем пейволл. Для цифровых товаров в ботах
Telegram требует **Telegram Stars** (XTR):

- Long polling → **webhook** (`bot.api.setWebhook`, grammY `webhookCallback`
  монтируется прямо в Fastify) — один процесс, ноль лишней инфры.
- SQLite → Postgres, когда появится второй инстанс.
- Очередь (BullMQ) для AI-запросов, если упрёшься в rate limit провайдера.
- Раздавай собранный webapp статикой с того же Fastify 
