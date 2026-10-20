// ============================================================
// "Campaign setup" card — icon left, label, action right:
//   Content submission form  Copy · Open
//   LucidLink folder         path + Copy (LucidLink paths aren't URLs)
//   Drive folder             Open
//   Brand approves in        value · Change
//   Content type             value
//   Tags                     #hashtags · @mentions
// ============================================================

import type { CampaignBundle, Playbook } from "@/lib/admin/campaigns/queries";
import { driveFolderUrl } from "@/lib/admin/campaigns/queries";
import { Card, Ico, ListRow, TextLink } from "./bits";
import CopyButton from "./CopyButton";

const APPROVES: Record<string, string> = {
  portal: "Brand portal",
  sheet: "External sheet",
  email: "Email",
};

export function campaignTags(c: CampaignBundle["campaign"]): string[] {
  const tags = [
    c.instagram_hashtag,
    c.instagram_hashtag2,
    c.instagram_hashtag3,
    c.tik_tok_hashtag,
    c.tik_tok_hash_tag2,
    c.tik_tok_hash_tag3,
  ]
    .filter((t): t is string => !!t && t.trim() !== "")
    .map((t) => (t.startsWith("#") ? t : `#${t}`));
  const mentions = [
    c.instagram_mention,
    c.instagram_mention2,
    c.instagram_mention3,
    c.tiktok_mention,
    c.tik_tok_mention2,
    c.tik_tok_mention3,
  ]
    .filter((t): t is string => !!t && t.trim() !== "")
    .map((t) => (t.startsWith("@") ? t : `@${t}`));
  return Array.from(new Set([...tags, ...mentions]));
}

export default function SetupCard({
  bundle,
  playbook,
  siteUrl,
}: {
  bundle: CampaignBundle;
  playbook: Playbook;
  siteUrl: string;
}) {
  const { campaign: c, extras } = bundle;
  const id = c.campaign_id;
  const editHref = `/admin/campaigns/${id}/edit`;
  const st = playbook.storage;

  const formUrl = playbook.submissionForm ? `${siteUrl}/submit/${playbook.submissionForm.public_token}` : null;
  const lucidPath = extras.lucidlink_folder_path || st?.lucid_root_path || null;
  const driveUrl = st?.campaign_folder_url || driveFolderUrl(extras.drive_folder_id || st?.campaign_folder_id);
  const approvesKey = extras.brand_approves_in || c.brand_approval_mode || null;
  const approves = approvesKey ? APPROVES[approvesKey] ?? approvesKey : null;
  const tags = campaignTags(c);

  return (
    <Card title="Campaign setup">
      <div className="-mt-1">
        <ListRow
          icon={<Ico name="up" />}
          label="Content submission form"
          right={
            formUrl ? (
              <>
                <CopyButton value={formUrl} />
                <span className="text-[12px] text-stone-400" title="The form editor moves over in the Content slice">
                  {playbook.submissionForm?.status === "live" ? "Live" : playbook.submissionForm?.status}
                </span>
              </>
            ) : (
              <span className="text-[12px] text-stone-400">Not made yet</span>
            )
          }
        />
        <ListRow
          icon={<Ico name="lucid" />}
          label={
            <>
              LucidLink folder
              {lucidPath && <div className="truncate font-mono text-[11px] text-stone-500">{lucidPath}</div>}
            </>
          }
          right={lucidPath ? <CopyButton value={lucidPath} label="Copy path" /> : <TextLink href={`${editHref}#playbook`}>+ Add</TextLink>}
        />
        <ListRow
          icon={<Ico name="drive" />}
          label="Drive folder"
          right={driveUrl ? <TextLink href={driveUrl} external>Open</TextLink> : <TextLink href={`${editHref}#playbook`}>+ Add</TextLink>}
        />
        <ListRow
          icon={<Ico name="check" />}
          label="Brand approves in"
          right={
            <>
              <span className="text-[13px] text-stone-900">{approves ?? <span className="text-stone-400">—</span>}</span>
              <TextLink href={`${editHref}#general`}>Change</TextLink>
            </>
          }
        />
        <ListRow
          icon={<Ico name="image" />}
          label="Content type"
          right={
            <span className="text-[13px] text-stone-900">
              {c.content_type || playbook.optinPage.data.content_type || <span className="text-stone-400">—</span>}
            </span>
          }
        />
        <ListRow
          icon={<Ico name="at" />}
          label="Tags"
          right={
            tags.length ? (
              <span className="text-[12px] text-stone-500">{tags.join(" · ")}</span>
            ) : (
              <TextLink href={`/admin/campaigns/${id}/page#tags`}>+ Add</TextLink>
            )
          }
        />
      </div>
    </Card>
  );
}
