// ============================================================
// /admin/app — App Viewer (app.cfm rebuilt). Embeds the Hub's own
// athlete app in a phone-sized frame so staff can see what
// athletes see without leaving the admin. (CF's version iframed
// the old mobile app; ours points at /athlete.)
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AppViewerPage() {
  await requireAdmin("staff");

  return (
    <div>
      <PageHeader
        title="App Viewer"
        subtitle="The athlete app (/athlete) in a phone frame — you'll see its login unless you also hold an athlete session"
      />
      <div className="flex justify-center">
        <div className="rounded-[36px] border-8 border-stone-900 bg-stone-900 shadow-xl">
          <iframe
            src="/athlete"
            title="Athlete app preview"
            className="h-[720px] w-[360px] rounded-[28px] bg-white"
          />
        </div>
      </div>
    </div>
  );
}
