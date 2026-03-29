/**
 * Groq OpenAI-compatible chat API for optional remediation AI (fix suggestions + plan enhancer).
 * @see https://console.groq.com/docs/api-reference#chat-create
 */

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Default when `GROQ_REMEDIATION_MODEL` is unset. */
export const DEFAULT_GROQ_REMEDIATION_MODEL = "openai/gpt-oss-120b";

export function getGroqRemediationModel(): string {
  return process.env.GROQ_REMEDIATION_MODEL?.trim() || DEFAULT_GROQ_REMEDIATION_MODEL;
}

/**
 * Returns assistant text or null if no key / HTTP error.
 */
export async function groqChatCompletion(
  userContent: string,
  maxTokens: number,
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  const model = getGroqRemediationModel();

  const response = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  if (text == null || text === "") return null;
  return text;
}
