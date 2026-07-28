// ============================================================
// /board — Peyton's personal task manager (staff-gated)
//
// Server component: gates the route to staff via requireStaff()
// (redirects anon → /login, athletes → /athlete), then hands the
// signed-in user's id to the interactive client. All data reads/writes
// happen client-side through RLS ("own tasks" = user_id = auth.uid()),
// so the id is used only to stamp new rows on insert.
// ============================================================

import { requireStaff } from "@/lib/staff-auth";
import BoardClient from "./BoardClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Board · Postgame",
};

export default async function BoardPage() {
  const staff = await requireStaff();
  return <BoardClient userId={staff.id} />;
}
