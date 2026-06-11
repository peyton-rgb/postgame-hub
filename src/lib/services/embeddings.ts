export async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-ada-002",
      input: text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embeddings ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

/** Build a single string from all tag fields for the embedding input. */
export function buildEmbeddingInput(tags: Record<string, unknown>): string {
  const parts: string[] = [];

  if (tags.visual_description) parts.push(String(tags.visual_description));
  if (tags.sport) parts.push(String(tags.sport));
  if (tags.school) parts.push(String(tags.school));

  const ctx = tags.context_tags as Record<string, string> | null;
  if (ctx) {
    for (const v of Object.values(ctx)) {
      if (v) parts.push(v);
    }
  }

  const social = tags.social_tags as Record<string, unknown> | null;
  if (social) {
    if (social.hook_style) parts.push(String(social.hook_style));
    if (social.pacing) parts.push(String(social.pacing));
    const platforms = social.estimated_platform_fit;
    if (Array.isArray(platforms)) parts.push(platforms.join(", "));
  }

  const pro = tags.pro_tags as Record<string, string> | null;
  if (pro) {
    for (const v of Object.values(pro)) {
      if (v) parts.push(v);
    }
  }

  const phrases = tags.search_phrases;
  if (Array.isArray(phrases)) parts.push(phrases.join(". "));

  const fit = tags.brief_fit;
  if (Array.isArray(fit) && fit.length) parts.push(fit.join(", "));

  return parts.join(" | ");
}
