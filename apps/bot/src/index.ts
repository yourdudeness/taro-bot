import 'dotenv/config';
import { bot } from './bot/bot.js';
import { startApi } from './api/server.js';

await bot.api.setMyCommands([
  { command: 'start',   description: 'Главное меню' },
  { command: 'tarot',   description: 'Новый расклад таро' },
  { command: 'credits', description: 'Сколько раскладов осталось' },
  { command: 'buy',     description: 'Купить расклады' },
]);

await startApi();
// long polling для дева; в проде переключить на webhook (см. README)
bot.start();
console.log('Bot started (long polling)');
