import {
  Bot,
  Context,
  InlineKeyboard,
  InputFile,
  InputMediaBuilder,
  session,
  type SessionFlavor,
} from "grammy";
import { existsSync } from "node:fs";
import { config } from "../config.js";
import {
  addCredits,
  getCredits,
  getExpiry,
  saveReading,
  spendCredit,
} from "../db.js";
import { complete } from "../services/ai.js";
import { TAROT_SYSTEM, tarotUserPrompt } from "../services/prompts.js";
import { cardImagePath, drawThreeCards } from "../services/tarot.js";

interface SessionData {
  awaitingQuestion: boolean;
}

export type BotContext = Context & SessionFlavor<SessionData>;

export const bot = new Bot<BotContext>(config.BOT_TOKEN);

bot.use(session({ initial: (): SessionData => ({ awaitingQuestion: false }) }));

const PACKS = [
  { id: "pack_15", label: "15 раскладов", credits: 15, stars: 149 },
  { id: "pack_50", label: "50 раскладов", credits: 50, stars: 399 },
  { id: "pack_150", label: "150 раскладов", credits: 150, stars: 999 },
] as const;

const mainMenu = new InlineKeyboard()
  .text("🔮 Таро расклад", "menu:tarot")
  .row()
  .text("⭐ Купить расклады", "menu:shop");

const shopMenu = new InlineKeyboard()
  .text("✨ 15 раскладов — 149 ⭐", "buy:pack_15")
  .row()
  .text("🔥 50 раскладов — 399 ⭐", "buy:pack_50")
  .row()
  .text("💫 150 раскладов — 999 ⭐", "buy:pack_150")
  .row()
  .text("← Назад", "menu:back");

bot.command("start", async (ctx) => {
  await ctx.reply(
    "Привет! Я помогу заглянуть чуть глубже в то что тебя волнует",
    { reply_markup: mainMenu },
  );
});

bot.command("credits", async (ctx) => {
  if (!ctx.from) return;
  const tgId = ctx.from.id;
  const credits = getCredits(tgId);
  const expiry = getExpiry(tgId);
  const expiryText =
    credits > 0 && expiry ? `\nДействуют до: ${formatExpiry(expiry)}` : "";
  await ctx.reply(`Осталось запросов: ${credits}${expiryText}`);
});

bot.command("tarot", async (ctx) => {
  ctx.session.awaitingQuestion = true;
  await ctx.reply(
    "Напиши свой вопрос для расклада — одним сообщением. Например: «Что меня ждёт в карьере в ближайшие месяцы?»",
  );
});

bot.command("buy", async (ctx) => {
  await ctx.reply("Выбери пакет раскладов:", { reply_markup: shopMenu });
});

bot.callbackQuery("menu:tarot", async (ctx) => {
  ctx.session.awaitingQuestion = true;
  await ctx.answerCallbackQuery();
  await ctx.reply(
    "Напиши свой вопрос для расклада — одним сообщением. Например: «Что меня ждёт в карьере в ближайшие месяцы?»",
  );
});

bot.callbackQuery("menu:shop", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("Выбери пакет раскладов:", { reply_markup: shopMenu });
});

bot.callbackQuery("menu:back", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("Выбери действие:", { reply_markup: mainMenu });
});

bot.callbackQuery(/^buy:(pack_\d+)$/, async (ctx) => {
  const packId = ctx.match[1];
  const pack = PACKS.find((p) => p.id === packId);
  if (!pack) {
    await ctx.answerCallbackQuery();
    return;
  }

  await ctx.answerCallbackQuery();
  await ctx.replyWithInvoice(
    pack.label,
    `${pack.credits} раскладов таро — задавай вопросы картам когда угодно`,
    packId,
    "XTR",
    [{ label: pack.label, amount: pack.stars }],
  );
});

// Telegram требует ответить в течение 10 секунд — подтверждаем без дополнительных проверок
bot.on("pre_checkout_query", async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

bot.on("message:successful_payment", async (ctx) => {
  const packId = ctx.message.successful_payment.invoice_payload;
  const pack = PACKS.find((p) => p.id === packId);
  if (!pack) return;

  const tgId = ctx.from.id;
  addCredits(tgId, pack.credits);
  const expiry = getExpiry(tgId);
  const expiryText = expiry ? `\nДействуют до: ${formatExpiry(expiry)}` : "";
  await ctx.reply(
    `Оплата прошла! Добавлено ${pack.credits} раскладов\nОсталось запросов: ${getCredits(tgId)}${expiryText}`,
    { reply_markup: mainMenu },
  );
});

bot.on("message:text", async (ctx) => {
  if (!ctx.session.awaitingQuestion) {
    await ctx.reply("Выбери действие:", { reply_markup: mainMenu });
    return;
  }
  ctx.session.awaitingQuestion = false;

  const question = ctx.message.text;

  if (isInjection(question)) {
    await ctx.reply(
      "Я умею только гадать на картах таро. Напиши свой вопрос для расклада.",
      { reply_markup: mainMenu },
    );
    return;
  }

  const tgId = ctx.from.id;
  if (!spendCredit(tgId)) {
    await ctx.reply(
      "Расклады закончились 🙏\nПополни запасы, чтобы продолжить:",
      { reply_markup: shopMenu },
    );
    return;
  }

  await ctx.replyWithChatAction("typing");

  try {
    const cards = drawThreeCards();
    const interpretation = await complete([
      { role: "system", content: TAROT_SYSTEM },
      { role: "user", content: tarotUserPrompt(question, cards) },
    ]);

    // Картинки: если файлы выложены в assets/cards — шлём альбомом, иначе текстом
    const paths = cards.map(cardImagePath);
    if (paths.every((p) => existsSync(p))) {
      const media = cards.map((c, i) =>
        InputMediaBuilder.photo(new InputFile(paths[i]), {
          caption: `${posEmoji(c.position)} ${c.name}${c.reversed ? " (перевёрнутая)" : ""}`,
        }),
      );
      await ctx.replyWithMediaGroup(media);
    } else {
      const list = cards
        .map(
          (c) =>
            `${posEmoji(c.position)} ${c.name}${c.reversed ? " (перевёрнутая)" : ""}`,
        )
        .join("\n");
      await ctx.reply(`Твои карты:\n\n${list}`);
    }

    saveReading(tgId, "tarot", { question, cards }, interpretation);
    await ctx.reply(interpretation, { reply_markup: mainMenu });
  } catch (err) {
    console.error("AI error:", err);
    addCredits(tgId, 1);
    await ctx.reply(
      "Карты сегодня молчат — что-то пошло не так. Попробуй ещё раз чуть позже.",
    );
  }
});

// Код-уровень защиты от prompt injection — до вызова Claude и списания кредита
function isInjection(text: string): boolean {
  const lower = text.toLowerCase();
  const patterns = [
    /забудь\s+(все\s+)?(предыдущ|инструк|команд|правил)/,
    /игнорируй\s+(все\s+)?(инструк|команд|правил|выше)/,
    /ignore\s+(all\s+)?(previous|prior|above|instruc)/,
    /forget\s+(all\s+)?(previous|prior|above|instruc)/,
    /ты\s+теперь/,
    /притворись|представь\s+что\s+ты|ты\s+—?\s*(не\s+)?бот|ты\s+—?\s*ии|ты\s+—?\s*gpt/,
    /раскрой\s+(свой\s+)?(промпт|систем|инструк)/,
    /покажи\s+(свой\s+)?(промпт|систем|инструк)/,
    /напиши\s+(мне\s+)?(анекдот|стихотворен|код|программ|рецепт|список)/,
    /расскажи\s+(мне\s+)?(анекдот|шутк|стихотворен)/,
    /write\s+(me\s+)?(code|program|joke|poem|recipe)/,
    /what\s+is\s+your\s+(system\s+)?prompt/,
    /переключись\s+в\s+режим|смени\s+роль|новая\s+роль/,
    /\[system\]|\[inst\]|<\|im_start\|>|<\|system\|>/,
  ];
  return patterns.some((re) => re.test(lower));
}

function posEmoji(p: "past" | "present" | "future"): string {
  return {
    past: "🕰 Прошлое:",
    present: "🌟 Настоящее:",
    future: "🌙 Будущее:",
  }[p];
}

function formatExpiry(isoUtc: string): string {
  const date = new Date(isoUtc.replace(" ", "T") + "Z");
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
