// ─── Таро ────────────────────────────────────────────────────────────

export type Suit = 'major' | 'wands' | 'cups' | 'swords' | 'pentacles';

export interface TarotCard {
  id: string;          // например "major_00", "cups_03"
  name: string;        // «Шут», «Тройка Кубков»
  nameEn: string;      // "The Fool" — пригодится для промпта и картинок
  suit: Suit;
  rank: number;        // 0–21 для старших, 1–14 для младших
}

export interface DrawnCard extends TarotCard {
  reversed: boolean;   // перевёрнутая позиция
  position: 'past' | 'present' | 'future';
}

// ─── API контракты ───────────────────────────────────────────────────

export interface ApiOk { ok: true }
export interface ApiError { ok: false; error: string }
