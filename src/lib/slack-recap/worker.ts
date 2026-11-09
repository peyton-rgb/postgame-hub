// src/lib/slack-recap/worker.ts
// Hand work to the background build worker (/api/slack/recap/build).
// Waits only until the worker accepts (202) — never for the build itself.

import { hubBase, workerHeaders } from "@/lib/slack-recap/api";

export interface WorkerBody {
  recapId: string;
  phase: "data" | "content" | "covers";
  trackerUrl?: string;
  folderUrl?: string;
  takeaways?: string;
}

export async function kickWorker(body: WorkerBody): Promise<boolean> {
  try {
    const res = await fetch(`${hubBase()}/api/slack/recap/build`, {
      method: "POST",
      headers: workerHeaders(),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (res.status !== 202) {
      console.error("[slack-recap] worker hand-off returned", res.status);
      return false;
    }
    return true;
  } catch (e: any) {
    console.error("[slack-recap] worker hand-off failed:", e?.message || e);
    return false;
  }
}
