// Shared by the list page and its Server Action. Lives outside the
// "use server" file because that file may only export async functions.
export const VIDEOGRAPHER_STATUSES = ["signed_up", "can_upload", "inactive"] as const;
export type VideographerStatus = (typeof VIDEOGRAPHER_STATUSES)[number];

export const STATUS_LABEL: Record<VideographerStatus, string> = {
  signed_up: "Signed up",
  can_upload: "Can upload",
  inactive: "Inactive",
};

export const STATUS_HELP: Record<VideographerStatus, string> = {
  signed_up: "Account only. They can sign in to the desktop app but see no campaigns and cannot upload.",
  can_upload: "Postgame granted storage access. Their assignments show in the desktop app and uploads land in LucidLink.",
  inactive: "Switched off. They can still sign in, but see nothing.",
};
