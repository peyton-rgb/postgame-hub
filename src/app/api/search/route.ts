import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// POST /api/search
//
// Vibe search: embeds a text query via OpenAI, then runs pgvector cosine
// similarity against inspo_items. Optional filters narrow results.
// ---------------------------------------------------------------------------

interface SearchRequestBody {
  query: string;
  limit?: number;
  filters?: {
    brand_id?: string;
    content_type?: string;
    source?: string;
    performance_tier?: string;
  };
}

async function generateEmbedding(text: string): Promise<number[]> {
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SearchRequestBody;

    if (!body.query?.trim()) {
      return NextResponse.json(
        { error: "query is required" },
        { status: 400 }
      );
    }

    const matchCount = Math.min(body.limit ?? 20, 50);
    const filters = body.filters ?? {};

    // 1. Embed the search query
    const embedding = await generateEmbedding(body.query.trim());

    // 2. Call the pgvector similarity function
    const supabase = createServiceSupabase();
    const { data, error } = await supabase.rpc("match_inspo_items", {
      query_embedding: JSON.stringify(embedding),
      match_count: matchCount,
      filter_brand_id: filters.brand_id || null,
      filter_content_type: filters.content_type || null,
      filter_source: filters.source || null,
      filter_performance_tier: filters.performance_tier || null,
    });

    if (error) {
      throw new Error(`Supabase RPC failed: ${error.message}`);
    }

    // 3. Enrich with brand names (the RPC doesn't join)
    const brandIds = Array.from(
      new Set(
        (data ?? [])
          .map((r: { brand_id: string | null }) => r.brand_id)
          .filter(Boolean)
      )
    );

    let brandsMap: Record<string, { id: string; name: string; logo_light_url: string | null; logo_url: string | null }> = {};
    if (brandIds.length > 0) {
      const { data: brands } = await supabase
        .from("brands")
        .select("id, name, logo_light_url, logo_url")
        .in("id", brandIds);
      if (brands) {
        brandsMap = Object.fromEntries(brands.map((b) => [b.id, b]));
      }
    }

    const results = (data ?? []).map(
      (row: Record<string, unknown> & { brand_id: string | null; similarity: number }) => ({
        ...row,
        brands: row.brand_id ? brandsMap[row.brand_id] ?? null : null,
      })
    );

    return NextResponse.json({
      results,
      count: results.length,
      query: body.query.trim(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/search] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
