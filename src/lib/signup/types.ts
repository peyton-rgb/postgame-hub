// ============================================================
// App user types — the one list every sign-up surface reads from.
//
// Product rules (Peyton, 2026-10-20): app users are current athletes,
// former athletes, coaches, videographers and agents. No "fan" type.
// Brand users and Postgame staff are separate sign-ins and are listed
// here only so the /signup chooser can point them to their own door.
//
// `code` matches user_types.code (migration 085) and is what goes into
// Supabase auth user metadata as `user_type`. The handle_new_user()
// trigger reads it to pick profiles.role / access_level.
// ============================================================

export const APP_USER_TYPES = [
  "current_athlete",
  "former_athlete",
  "coach",
  "videographer",
  "agent",
] as const;

export type AppUserType = (typeof APP_USER_TYPES)[number];

/** Every kind of person who can sign in somewhere. */
export type SignupUserType = AppUserType | "brand" | "staff";

export function isAppUserType(value: unknown): value is AppUserType {
  return typeof value === "string" && (APP_USER_TYPES as readonly string[]).includes(value);
}

export interface SignupChoice {
  code: SignupUserType;
  label: string;
  blurb: string;
  /** Where the chooser sends them. */
  href: string;
  /** Small note under the card ("Google sign-in", "Desktop app", …). */
  note?: string;
}

/**
 * The /signup chooser cards, in the order Peyton listed them.
 *
 * Athlete types go to the EXISTING /athlete/signup with ?type= so that
 * flow can put `user_type` into the sign-up metadata (see the note in
 * src/app/signup/page.tsx — that page is outside this branch's scope).
 */
export const SIGNUP_CHOICES: SignupChoice[] = [
  {
    code: "current_athlete",
    label: "Current athlete",
    blurb: "On a roster now — college, high school or pro. Get paid for brand deals.",
    href: "/athlete/signup?type=current",
  },
  {
    code: "former_athlete",
    label: "Former athlete",
    blurb: "Finished playing, still bookable. Keep your profile and your deals.",
    href: "/athlete/signup?type=former",
  },
  {
    code: "coach",
    label: "Coach",
    blurb: "Coaches and team staff. Postgame reviews your request before access.",
    href: "/signup/coach",
  },
  {
    code: "videographer",
    label: "Videographer",
    blurb: "Shoot Postgame campaigns. Create your account, then download the desktop app.",
    href: "/desktop#signup",
    note: "Desktop app",
  },
  {
    code: "agent",
    label: "Agent",
    blurb: "Represent athletes. Postgame reviews your request, then you can invite your roster.",
    href: "/signup/agent",
  },
  {
    code: "brand",
    label: "Brand",
    blurb: "Client contacts use the brand portal. You need an invite link from your Postgame team.",
    href: "/portal/signup",
    note: "Brand portal",
  },
  {
    code: "staff",
    label: "Postgame staff",
    blurb: "Sign in with your @pstgm.com Google account.",
    href: "/login",
    note: "Google sign-in",
  },
];

/** Human label for a user_type code (used by /admin). */
export const USER_TYPE_LABELS: Record<SignupUserType, string> = {
  current_athlete: "Current athlete",
  former_athlete: "Former athlete",
  coach: "Coach",
  videographer: "Videographer",
  agent: "Agent",
  brand: "Brand user",
  staff: "Postgame staff",
};
