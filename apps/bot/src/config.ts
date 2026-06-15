import { z } from 'zod';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

const schema = z.object({
  BOT_TOKEN: z.string().min(10),
  AI_BASE_URL: z.string().url(),
  AI_API_KEY: z.string().min(1),
  AI_MODEL: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  DEV_MODE: z.coerce.boolean().default(false),
  DEV_USER_ID: z.coerce.number().default(0),
});

// Падаем сразу при старте, если env неполный — лучше, чем в рантайме
export const config = schema.parse(process.env);
