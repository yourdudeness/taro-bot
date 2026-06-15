import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TgWebAppUser {
  id: number;
  first_name: string;
  username?: string;
}

const MAX_AGE_SECONDS = 3600; // initData старше часа не принимаем

/**
 * Проверка подписи Telegram WebApp initData (HMAC-SHA256).
 * Без этой проверки кто угодно может дёргать твой API в обход Telegram
 * и жечь твои AI-токены. https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateInitData(initData: string, botToken: string): TgWebAppUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get('auth_date') ?? 0);
  if (Date.now() / 1000 - authDate > MAX_AGE_SECONDS) return null;

  try {
    const user = JSON.parse(params.get('user') ?? '');
    return typeof user?.id === 'number' ? (user as TgWebAppUser) : null;
  } catch {
    return null;
  }
}
