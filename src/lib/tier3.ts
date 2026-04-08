import { createServerSupabase } from "@/lib/supabase-server";
import type { Database } from "@/types/supabase";

export type Tier3Submission = Database["public"]["Tables"]["tier3_submissions"]["Row"];

export async function listPendingSubmissions(limit = 50) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("tier3_submissions")
    .select("*")
    .in("status", ["pending_review", "scored"])
    .order("score_composite", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Tier3Submission[];
}

export async function getSubmissionById(id: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("tier3_submissions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as Tier3Submission;
}
