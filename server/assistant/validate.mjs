/** Request checks, kept separate from the server so they can be unit tested. */

export const LIMITS = {
  messages: 40,
  messageChars: 4000,
  summaryChars: 3000,
};

/**
 * Validates a chat request body. Returns { messages, summary } ready for the
 * model, or { error } with a message safe to show the person.
 */
export function parseChatRequest(body) {
  if (!body || typeof body !== 'object') return { error: 'Invalid request.' };
  const { messages, summary } = body;

  if (!Array.isArray(messages) || messages.length === 0) return { error: 'Send at least one message.' };
  if (messages.length > LIMITS.messages) return { error: 'This conversation is too long. Start a new one to keep going.' };

  const clean = [];
  for (const [i, m] of messages.entries()) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
      return { error: 'Invalid message.' };
    }
    const content = m.content.trim();
    if (!content) return { error: 'Messages can’t be empty.' };
    if (content.length > LIMITS.messageChars) return { error: 'That message is too long. Try a shorter one.' };
    const expected = i % 2 === 0 ? 'user' : 'assistant';
    if (m.role !== expected) return { error: 'Invalid conversation order.' };
    clean.push({ role: m.role, content });
  }
  if (clean.at(-1).role !== 'user') return { error: 'The last message must be yours.' };

  let cleanSummary = null;
  if (summary != null) {
    if (typeof summary !== 'string') return { error: 'Invalid cycle summary.' };
    // The summary is wrapped in tags for the model; strip anything that could
    // close them early.
    cleanSummary = summary.replace(/<\/?cycle_summary>/gi, '').trim().slice(0, LIMITS.summaryChars) || null;
  }
  return { messages: clean, summary: cleanSummary };
}

/**
 * Builds the API messages. The summary rides on the latest user message, so
 * the earlier turns stay byte-identical and keep hitting the prompt cache.
 */
export function toApiMessages(messages, summary) {
  return messages.map((m, i) => {
    if (i !== messages.length - 1 || !summary) return { role: m.role, content: m.content };
    return {
      role: 'user',
      content: [
        { type: 'input_text', text: `<cycle_summary>\n${summary}\n</cycle_summary>` },
        { type: 'input_text', text: m.content },
      ],
    };
  });
}
