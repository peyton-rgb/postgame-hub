// ============================================================
// "Campaign Playbook" card — two columns:
//   Google files   SOW · Invoice · Brief · Internal sheet · External
//                  sheet · Performance tracker   → Open or "+ Add"
//   Athlete pages  Opt-in page · App card · Athlete contract · Deal
//                  page · Content submission form · Posting
//                  instructions, each with App · Web status dots
//   Brand & team   Creator brief · Recap
//
// Every status comes from a real row; a page whose editor hasn't been
// rebuilt in the Hub yet says so instead of linking to a dead route.
// ============================================================

import type { CampaignBundle, Playbook, PageStatus } from "@/lib/admin/campaigns/queries";
import { sheetUrl } from "@/lib/admin/campaigns/queries";
import { Card, GroupHead, Ico, ListRow, Pill, TextLink } from "./bits";

function openLink(href: string | null, external: boolean, icon?: React.ReactNode) {
  if (!href) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon && <span className="text-stone-500">{icon}</span>}
      <TextLink href={href} external={external}>
        Open
      </TextLink>
    </span>
  );
}

function StatusDot({ k, s }: { k: "App" | "Web"; s: PageStatus }) {
  const dot =
    s === "live"
      ? "bg-status-ok border-status-ok"
      : s === "draft"
        ? "bg-status-warn border-status-warn"
        : "border-stone-300 bg-transparent";
  const title = `${k}: ${s === "live" ? "live" : s === "draft" ? "draft" : "not made"}`;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-stone-500" title={title}>
      <i className={"inline-block h-2 w-2 rounded-full border " + dot} />
      {k}
    </span>
  );
}

function Soon({ label = "Editor not rebuilt yet" }: { label?: string }) {
  return <span className="text-[12px] text-stone-400" title="This screen moves over from the old admin in a later slice">{label}</span>;
}

export default function PlaybookCard({ bundle, playbook }: { bundle: CampaignBundle; playbook: Playbook }) {
  const { campaign: c, extras } = bundle;
  const id = c.campaign_id;
  const editHref = `/admin/campaigns/${id}/edit#playbook`;
  const st = playbook.storage;

  const files: { label: string; href: string | null; icon: React.ReactNode }[] = [
    { label: "Campaign SOW", href: c.sow_link, icon: <Ico name="doc" /> },
    { label: "Campaign Invoice", href: c.invoice_link, icon: <Ico name="doc" /> },
    { label: "Campaign Brief", href: c.campaign_brief_link, icon: <Ico name="doc" /> },
    { label: "Internal sheet", href: extras.internal_sheet_link || sheetUrl(st?.internal_sheet_id), icon: <Ico name="sheet" /> },
    { label: "External sheet", href: extras.external_sheet_link || sheetUrl(st?.external_sheet_id), icon: <Ico name="sheet" /> },
    {
      label: "Performance tracker",
      href: extras.performance_tracker_link || st?.performance_tracker_url || c.campaign_tracker,
      icon: <Ico name="sheet" />,
    },
  ];

  const cardStatus: PageStatus = !playbook.appCard
    ? "none"
    : playbook.appCard.status === "live"
      ? "live"
      : playbook.appCard.status === "draft"
        ? "draft"
        : "none";
  const formStatus: PageStatus = !playbook.submissionForm
    ? "none"
    : playbook.submissionForm.status === "live"
      ? "live"
      : playbook.submissionForm.status === "draft"
        ? "draft"
        : "none";
  const optinStatus: PageStatus = playbook.optinPage.exists ? (c.is_active ? "live" : "draft") : "none";
  const contractStatus: PageStatus = c.contract ? "live" : "none";
  const postingStatus: PageStatus = playbook.postingSettings ? "live" : "none";

  const pages: { label: string; app: PageStatus; web: PageStatus; right: React.ReactNode }[] = [
    {
      label: "Opt-in page",
      app: optinStatus,
      web: optinStatus,
      right: (
        <TextLink href={`/admin/campaigns/${id}/page`}>{playbook.optinPage.exists ? "Open" : "+ Create"}</TextLink>
      ),
    },
    {
      label: "App card",
      app: cardStatus,
      web: "none",
      right: playbook.appCard ? <TextLink href="/admin/app">Open</TextLink> : <Soon label="+ Create · Cards screen soon" />,
    },
    {
      label: "Athlete contract",
      app: contractStatus,
      web: contractStatus,
      right: <TextLink href={`/admin/campaigns/${id}/page#contract`}>{c.contract ? "Open" : "+ Create"}</TextLink>,
    },
    { label: "Deal page", app: "none", web: "none", right: <Soon label="+ Create · later slice" /> },
    {
      label: "Content submission form",
      app: formStatus,
      web: formStatus,
      right: playbook.submissionForm ? <Soon label="Made · editor soon" /> : <Soon label="+ Create · editor soon" />,
    },
    {
      label: "Posting instructions",
      app: postingStatus,
      web: postingStatus,
      right: <TextLink href="/dashboard/posting-instructions">{playbook.postingSettings ? "Open" : "+ Create"}</TextLink>,
    },
  ];

  const team: { label: string; made: boolean; right: React.ReactNode }[] = [
    {
      label: "Creator brief",
      made: playbook.creatorBrief,
      right: playbook.creatorBrief ? <Soon label="Made · editor soon" /> : <TextLink href="/dashboard/briefs">+ Create</TextLink>,
    },
    {
      label: "Recap",
      made: !!playbook.recap,
      right: playbook.recap ? (
        <TextLink href={`/dashboard/${playbook.recap.id}`}>Open</TextLink>
      ) : (
        <TextLink href="/dashboard/recaps">+ Create</TextLink>
      ),
    },
  ];

  return (
    <Card title="Campaign Playbook">
      <div className="grid grid-cols-1 gap-x-6 gap-y-1 pt-1 md:grid-cols-2">
        <div>
          <GroupHead>Google files</GroupHead>
          {files.map((f) => (
            <ListRow
              key={f.label}
              label={f.label}
              right={
                f.href ? (
                  openLink(f.href, true, f.icon)
                ) : (
                  <TextLink href={editHref}>+ Add</TextLink>
                )
              }
            />
          ))}
        </div>
        <div>
          <GroupHead right="app · web">Athlete pages</GroupHead>
          {pages.map((p) => (
            <ListRow
              key={p.label}
              label={p.label}
              right={
                <>
                  <span className="flex gap-2.5">
                    <StatusDot k="App" s={p.app} />
                    <StatusDot k="Web" s={p.web} />
                  </span>
                  {p.right}
                </>
              }
            />
          ))}
          <div className="pt-3">
            <GroupHead>Brand &amp; team</GroupHead>
            {team.map((t) => (
              <ListRow
                key={t.label}
                label={t.label}
                right={
                  <>
                    {t.made && <Pill tone="ok">Live</Pill>}
                    {t.right}
                  </>
                }
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
