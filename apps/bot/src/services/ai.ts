import { config } from '../config.js';

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

/**
 * Один fetch вместо SDK: DeepSeek, Gemini (openai-compat endpoint) и OpenAI
 * принимают одинаковый формат. Провайдер переключается в .env без правок кода.
 */
export async function complete(messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${config.AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: config.AI_MODEL,
      messages,
      max_tokens: 1200,
      temperature: 0.8,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`AI API ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('AI API вернул пустой ответ');
  return text;
}
