// Встроенный SQLite (Node 22+): без нативной сборки, ничего не ломается при деплое.
// При втором инстансе/масштабировании — мигрировать на Postgres.
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('tarot.sqlite');
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    tg_id            INTEGER PRIMARY KEY,
    credits          INTEGER NOT NULL DEFAULT 3,
    credits_expire_at TEXT,
    created_at       TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS readings (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_id      INTEGER NOT NULL,
    kind       TEXT NOT NULL,
    payload    TEXT NOT NULL,
    result     TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Миграция для существующих баз: добавляем колонку если её ещё нет
try {
  db.exec("ALTER TABLE users ADD COLUMN credits_expire_at TEXT");
} catch {
  // колонка уже есть — игнорируем
}

export function ensureUser(tgId: number): void {
  // Бесплатные 3 кредита тоже живут 30 дней с момента регистрации
  db.prepare(`
    INSERT OR IGNORE INTO users (tg_id, credits_expire_at)
    VALUES (?, datetime('now', '+30 days'))
  `).run(tgId);
}

function expireIfNeeded(tgId: number): void {
  db.prepare(`
    UPDATE users SET credits = 0, credits_expire_at = NULL
    WHERE tg_id = ? AND credits > 0
      AND credits_expire_at IS NOT NULL
      AND credits_expire_at < datetime('now')
  `).run(tgId);
}

export function getCredits(tgId: number): number {
  ensureUser(tgId);
  expireIfNeeded(tgId);
  const row = db.prepare('SELECT credits FROM users WHERE tg_id = ?').get(tgId) as
    | { credits: number }
    | undefined;
  return row?.credits ?? 0;
}

export function getExpiry(tgId: number): string | null {
  ensureUser(tgId);
  const row = db.prepare('SELECT credits_expire_at FROM users WHERE tg_id = ?').get(tgId) as
    | { credits_expire_at: string | null }
    | undefined;
  return row?.credits_expire_at ?? null;
}

/** Атомарно списывает кредит; false — кредитов нет, пора показать пейволл */
export function spendCredit(tgId: number): boolean {
  ensureUser(tgId);
  expireIfNeeded(tgId);
  const res = db
    .prepare('UPDATE users SET credits = credits - 1 WHERE tg_id = ? AND credits > 0')
    .run(tgId);
  return res.changes > 0;
}

/** При покупке обнуляет таймер: 30 дней от момента оплаты */
export function addCredits(tgId: number, amount: number): void {
  ensureUser(tgId);
  db.prepare(`
    UPDATE users
    SET credits = credits + ?, credits_expire_at = datetime('now', '+30 days')
    WHERE tg_id = ?
  `).run(amount, tgId);
}

export function saveReading(tgId: number, kind: 'tarot', payload: unknown, result: string): void {
  db.prepare('INSERT INTO readings (tg_id, kind, payload, result) VALUES (?, ?, ?, ?)')
    .run(tgId, kind, JSON.stringify(payload), result);
}
