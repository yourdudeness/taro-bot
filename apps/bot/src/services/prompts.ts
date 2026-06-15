import type { DrawnCard } from "@tarot/shared";

import fs from "fs";
import path from "path";

const promptPath = path.join(process.cwd(), "prompts", "tarot-system.txt");

export const TAROT_SYSTEM = fs.readFileSync(promptPath, "utf8");

export function tarotUserPrompt(question: string, cards: DrawnCard[]): string {
  const list = cards
    .map(
      (c) =>
        `${posRu(c.position)}: ${c.name} (${c.nameEn})${c.reversed ? " — перевёрнутая" : ""}`,
    )
    .join("\n");
  return `Вопрос пользователя: «${question.slice(0, 500)}»\n\nВыпавшие карты:\n${list}\n\nДай интерпретацию.`;
}

function posRu(p: DrawnCard["position"]): string {
  return { past: "Прошлое", present: "Настоящее", future: "Будущее" }[p];
}
