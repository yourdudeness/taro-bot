import { randomInt } from 'node:crypto';
import type { DrawnCard, TarotCard } from '@tarot/shared';

const MAJOR: Array<[string, string]> = [
  ['Шут', 'The Fool'], ['Маг', 'The Magician'], ['Верховная Жрица', 'The High Priestess'],
  ['Императрица', 'The Empress'], ['Император', 'The Emperor'], ['Иерофант', 'The Hierophant'],
  ['Влюблённые', 'The Lovers'], ['Колесница', 'The Chariot'], ['Сила', 'Strength'],
  ['Отшельник', 'The Hermit'], ['Колесо Фортуны', 'Wheel of Fortune'], ['Справедливость', 'Justice'],
  ['Повешенный', 'The Hanged Man'], ['Смерть', 'Death'], ['Умеренность', 'Temperance'],
  ['Дьявол', 'The Devil'], ['Башня', 'The Tower'], ['Звезда', 'The Star'],
  ['Луна', 'The Moon'], ['Солнце', 'The Sun'], ['Суд', 'Judgement'], ['Мир', 'The World'],
];

const SUITS = [
  { suit: 'wands' as const, ru: 'Жезлов', en: 'Wands' },
  { suit: 'cups' as const, ru: 'Кубков', en: 'Cups' },
  { suit: 'swords' as const, ru: 'Мечей', en: 'Swords' },
  { suit: 'pentacles' as const, ru: 'Пентаклей', en: 'Pentacles' },
];

const RANKS: Array<[string, string]> = [
  ['Туз', 'Ace'], ['Двойка', 'Two'], ['Тройка', 'Three'], ['Четвёрка', 'Four'],
  ['Пятёрка', 'Five'], ['Шестёрка', 'Six'], ['Семёрка', 'Seven'], ['Восьмёрка', 'Eight'],
  ['Девятка', 'Nine'], ['Десятка', 'Ten'], ['Паж', 'Page'], ['Рыцарь', 'Knight'],
  ['Королева', 'Queen'], ['Король', 'King'],
];

export const DECK: TarotCard[] = [
  ...MAJOR.map(([name, nameEn], i) => ({
    id: `major_${String(i).padStart(2, '0')}`,
    name, nameEn, suit: 'major' as const, rank: i,
  })),
  ...SUITS.flatMap(({ suit, ru, en }) =>
    RANKS.map(([rankRu, rankEn], i) => ({
      id: `${suit}_${String(i + 1).padStart(2, '0')}`,
      name: `${rankRu} ${ru}`,
      nameEn: `${rankEn} of ${en}`,
      suit,
      rank: i + 1,
    })),
  ),
];

const POSITIONS = ['past', 'present', 'future'] as const;

/** Криптографически честный рандом: 3 уникальные карты + ориентация */
export function drawThreeCards(): DrawnCard[] {
  const indices = new Set<number>();
  while (indices.size < 3) indices.add(randomInt(DECK.length));

  return [...indices].map((idx, i) => ({
    ...DECK[idx],
    reversed: randomInt(2) === 1,
    position: POSITIONS[i],
  }));
}

/** Путь к картинке карты; если файла нет — бот пошлёт текст без фото */
export function cardImagePath(card: TarotCard): string {
  return new URL(`../../assets/cards/${card.id}.jpg`, import.meta.url).pathname;
}
