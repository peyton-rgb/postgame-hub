// Plain data shapes the audience builder (a client component) receives
// from its server page. No imports from server code on purpose.

export interface AudienceDraft {
  id: string | null;
  name: string;
  description: string;
  include: "all" | "app" | "noapp";
  levels: Array<"college" | "high_school" | "pro" | "former">;
  influencers: boolean;
  handles: string;
  states: string[];
  genders: string[];
  colleges: string[];
  sports: string[];
  min: string;
  max: string;
  rating: string;
  exclude: string;
  excludeCampaigns: string[];
}

export interface BuilderOptions {
  states: string[];
  colleges: string[];
  sports: string[];
  campaigns: Array<{ id: string; label: string }>;
  levelCounts: Record<"college" | "high_school" | "pro" | "former", number | null>;
}
