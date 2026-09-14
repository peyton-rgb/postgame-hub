import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
import { logAdminAction } from "@/lib/admin/audit";

// ============================================================
// /portal/auth/callback — where the OAuth handshake lands.
//
// THIS ROUTE IS THE ONLY GATE. The provider will happily authenticate any
// Google or Microsoft account in the world; being signed in proves only
// that the address is real. Membership is decided here, against
// brand_contacts, and nowhere else.
//
// Order of work, and why:
//   1. exchange the code for a session
//   2. identify the account — a Hub login is turned away WITHOUT being
//      signed out (see NOTE below)
//   3. the brand_contacts check
//   4. profiles row at brand level
//   5. link postgame_contacts.profile_id   <- what makes the session work
//   6. stamp brand_contacts.profile_id + activate the attachment
//   7. audit, then land on /portal
//
// Deliberately NOT /auth/callback, which is the staff Google door and
// hard-rejects anything that is not @pstgm.com — the exact opposite of
// what a brand contact needs.
//
// NOTE — WHY A HUB LOGIN IS NOT SIGNED OUT. The exchange replaces
// whatever session the browser held. If a staff member signs in here with
// their @pstgm.com account, the session we now hold IS their staff
// session. Signing it out to refuse them would log them out of the Hub
// entirely, from a page they were only looking at. So a recognised Hub
// account is redirected with an explanation and keeps its session; only a
// session that belongs to nobody we serve gets signed out.
// ============================================================

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/** Access levels that mean "this is a Postgame login, not a client login". */
const HUB_LEVELS = new Set(["exec", "admin", "staff", "athlete"]);

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  // Build the success response FIRST so the Supabase client can attach
  // session cookies to it while exchanging the code.
  const response = NextResponse.redirect(`${origin}/portal`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // The provider can also come back with its own refusal (user cancelled,
  // consent declined). Nothing to exchange in that case.
  if (searchParams.get("error") || !code) {
    return reroute(response, `${origin}/portal/login?error=auth`);
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error(`[portal-callback] code exchange failed: ${exchangeError.message}`);
    return reroute(response, `${origin}/portal/login?error=auth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.trim().toLowerCase();

  if (!user || !email) {
    await supabase.auth.signOut();
    return reroute(response, `${origin}/portal/login?error=auth`);
  }

  // Service client from here. A brand user has no RLS grant to read the
  // junction, and createLiveServiceSupabase specifically CANNOT serve a
  // cached row — this is an access decision, so a stale read would be a
  // security bug rather than a staleness annoyance.
  const svc = createLiveServiceSupabase();

  // ---- 2 · is this already a Hub login? ---------------------------
  const { data: profile } = await svc
    .from("profiles")
    .select("id, email, role, access_level")
    .eq("id", user.id)
    .maybeSingle();

  const existingLevel = profileLevel(profile);
  if (existingLevel && HUB_LEVELS.has(existingLevel)) {
    // Session intentionally left intact — see NOTE at the top.
    return reroute(response, `${origin}/portal/login?error=hub-account`);
  }

  // ---- 3 · THE GATE ------------------------------------------------
  const attachments = await findAttachments(svc, email);

  if (attachments.length === 0) {
    // Belongs to nobody we serve, so the session goes.
    await supabase.auth.signOut();
    return reroute(response, `${origin}/portal/login?error=not-invited`);
  }

  const nowIso = new Date().toISOString();

  // ---- 4 · profiles row at brand level -----------------------------
  if (!profile) {
    const { error } = await svc.from("profiles").insert({
      id: user.id,
      email,
      role: "brand",
      access_level: "brand",
    });
    if (error) {
      console.error(`[portal-callback] profile insert failed: ${error.message}`);
      await supabase.auth.signOut();
      return reroute(response, `${origin}/portal/login?error=auth`);
    }
  }

  // ---- 5 · identity <-> login --------------------------------------
  // getBrandSession() resolves scope as
  //   profiles.id -> postgame_contacts.profile_id -> brand_contacts.contact_id
  // so WITHOUT this link a successful sign-in lands on /portal/denied.
  // This is the OTHER profile_id — see the name-twin note in CLAUDE.md.
  const { data: alreadyLinked } = await svc
    .from("postgame_contacts")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!alreadyLinked) {
    // `.is("profile_id", null)` so we can never steal an identity that
    // another login already owns — postgame_contacts.profile_id carries a
    // unique index, and stealing it would break the other login instead.
    const { error } = await svc
      .from("postgame_contacts")
      .update({ profile_id: user.id })
      .eq("id", attachments[0].contact_id)
      .is("profile_id", null);
    if (error) {
      console.error(`[portal-callback] identity link failed: ${error.message}`);
    }
  }

  // ---- 6 · stamp + activate the attachments ------------------------
  const ids = attachments.map((a) => a.id);

  // (a) Claim unclaimed attachments. `.is("profile_id", null)` so this can
  // never take an attachment another login already holds.
  await svc
    .from("brand_contacts")
    .update({ profile_id: user.id, status: "active" })
    .in("id", ids)
    .is("profile_id", null);

  // (b) Stamp the activation date ONLY where there isn't one.
  //
  // Deliberately a separate statement scoped to activated_at IS NULL,
  // rather than being folded into (a). profile_id and activated_at are
  // independently populated in the live data: the pilot attachment was
  // activated on 2026-08-17 through the password signup flow, which set
  // activated_at but not profile_id (the column did not exist yet). Setting
  // both together on "profile_id is null" would silently rewrite that real
  // August date to today the first time they sign in with OAuth. Checked
  // against the actual row before writing this.
  await svc
    .from("brand_contacts")
    .update({ activated_at: nowIso })
    .in("id", ids)
    .eq("profile_id", user.id)
    .is("activated_at", null);

  // (c) Rows already claimed by THIS login that are still sitting at
  // invited or bounced. Scoped to their own profile_id, so this cannot
  // touch anyone else's attachment.
  await svc
    .from("brand_contacts")
    .update({ status: "active" })
    .in("id", ids)
    .eq("profile_id", user.id)
    .neq("status", "active");

  // ---- 7 · audit ---------------------------------------------------
  await logAdminAction({
    actorId: user.id,
    actorEmail: email,
    action: "contact.activate",
    entity: "brand_contacts",
    entityId: attachments[0].id,
    before: { status: attachments[0].status },
    after: {
      status: "active",
      profile_id: user.id,
      contact_id: attachments[0].contact_id,
      brand_id: attachments[0].brand_id,
      attachments: ids.length,
      via: "oauth",
    },
  });

  return response;
}

interface Attachment {
  id: string;
  brand_id: string;
  contact_id: string;
  status: string;
  profile_id: string | null;
  invited_email: string | null;
  signup_email: string | null;
}

const ATTACHMENT_COLUMNS =
  "id, brand_id, contact_id, status, profile_id, invited_email, signup_email";

/**
 * Escape the characters LIKE treats as wildcards, so an address is matched
 * as a literal string.
 *
 * NOT cosmetic. `_` matches any single character in LIKE/ILIKE and is a
 * perfectly ordinary character in an email address, so an invited
 * `john_smith@cvs.com` would ALSO be matched by `johnXsmith@cvs.com` —
 * verified against Postgres before writing this. `%` behaves the same way
 * and is worse. On an access gate that is a way in, not a tidiness
 * problem.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Every non-revoked attachment whose invite or signup address is this
 * email, case-insensitively.
 *
 * Two queries rather than one `.or()` filter on purpose. PostgREST's `or`
 * takes a comma-separated expression string, and an email is exactly the
 * kind of value that carries characters with meaning in it (`+` in
 * `name+tag@host`, dots, an `@`). This is the access gate, so it is worth
 * two round trips to keep the filter values unambiguous rather than
 * depending on how a composed filter string gets escaped.
 *
 * TWO LAYERS, on purpose. The database narrows with an escaped `ilike`
 * (a case-insensitive match on a literal), and then every row is
 * re-checked here with an exact lowercase comparison. The second layer is
 * the authoritative one: it means the gate does not depend on how
 * PostgREST or Postgres interpret any character inside an address, which
 * for the thing deciding access is worth a few lines.
 */
async function findAttachments(
  svc: ReturnType<typeof createLiveServiceSupabase>,
  email: string
): Promise<Attachment[]> {
  const pattern = escapeLike(email);

  const [invited, signup] = await Promise.all([
    svc
      .from("brand_contacts")
      .select(ATTACHMENT_COLUMNS)
      .neq("status", "revoked")
      .ilike("invited_email", pattern),
    svc
      .from("brand_contacts")
      .select(ATTACHMENT_COLUMNS)
      .neq("status", "revoked")
      .ilike("signup_email", pattern),
  ]);

  if (invited.error) console.error(`[portal-callback] invited_email lookup: ${invited.error.message}`);
  if (signup.error) console.error(`[portal-callback] signup_email lookup: ${signup.error.message}`);

  const byId = new Map<string, Attachment>();
  for (const row of [...(invited.data ?? []), ...(signup.data ?? [])] as Attachment[]) {
    // The authoritative check. A row only counts if one of its addresses
    // IS this address, character for character, ignoring case.
    const matches =
      row.invited_email?.trim().toLowerCase() === email ||
      row.signup_email?.trim().toLowerCase() === email;
    if (matches) byId.set(row.id, row);
  }
  // Array.from rather than a spread: this project targets ES5, where
  // spreading a Map iterator needs --downlevelIteration.
  return Array.from(byId.values());
}

/**
 * The access level of an existing profiles row, falling back to `role`
 * the same way lib/admin/auth.ts does — so a row written before
 * access_level existed still reads correctly rather than looking like a
 * brand-new account.
 */
function profileLevel(
  profile: { role?: string | null; access_level?: string | null } | null
): string | null {
  if (!profile) return null;
  if (profile.access_level) return profile.access_level;
  const role = profile.role ?? "";
  if (role === "brand") return "brand";
  if (role === "athlete") return "athlete";
  if (role === "admin") return "admin";
  return role ? "staff" : null;
}

/**
 * Redirect somewhere else while KEEPING every cookie already written on
 * `response`.
 *
 * This matters more than it looks. The Supabase client is bound to
 * `response`, so `signOut()` writes its session-clearing cookies there.
 * Returning a fresh NextResponse.redirect() would discard them and the
 * sign-out would silently not happen — leaving a refused visitor holding
 * a live session, which is the opposite of what the refusal intends.
 */
function reroute(response: NextResponse, url: string): NextResponse {
  const out = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) out.cookies.set(cookie);
  return out;
}
