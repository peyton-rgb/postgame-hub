// src/lib/slack-recap/step.ts
// ─────────────────────────────────────────────────────────────
// "Open recap request form" — a custom Workflow Builder step.
//
// Slack only lets a channel FEATURE a workflow (the big button that replaces
// the message box), not an app shortcut. So the Postgame Hub app ships a
// one-job step: when a featured workflow runs it, Slack sends a
// `function_executed` event (to /api/cascade, the app's events URL), and we
// open the same request form the launcher button and /request shortcut open.
//
// The step is finished (functions.completeSuccess) as soon as the form is
// open; the form's submit is handled like any other by /api/slack/recap.
// ─────────────────────────────────────────────────────────────

import { slack } from "./api";
import { requestModal } from "./views";

/** Must match the `functions` key in the Slack app manifest. */
export const RECAP_STEP_CALLBACK_ID = "open_recap_request_step";

export function isRecapStepEvent(event: any): boolean {
  return event?.type === "function_executed" && event?.function?.callback_id === RECAP_STEP_CALLBACK_ID;
}

/**
 * Open the form right away — the interactivity pointer is short-lived, like a
 * trigger_id — and return a promise that finishes the workflow step.
 */
export async function handleRecapStep(event: any): Promise<() => Promise<void>> {
  const executionId: string | undefined = event?.function_execution_id;
  const token: string | undefined = event?.bot_access_token;
  const pointer: string | undefined = event?.inputs?.interactivity?.interactivity_pointer;

  // Open with the app's own bot token first. A view opened with the workflow
  // (just-in-time) token becomes "function-scoped": Slack then routes its
  // dropdown searches, picks and Submit as workflow events instead of to the
  // Interactivity URL, so the brand/campaign search finds nothing. A bot-token
  // view behaves exactly like the pinned launcher's form. The workflow token
  // is only a fallback if Slack refuses the pointer for the bot token.
  let opened: any = { ok: false, error: "no interactivity pointer — is the step's input wired to the workflow trigger?" };
  if (pointer) {
    opened = await slack("views.open", { interactivity_pointer: pointer, view: requestModal({}, null) });
    if (!opened.ok && token) {
      console.warn("[slack-recap] step: bot-token views.open failed, falling back to workflow token:", opened.error);
      opened = await slack("views.open", { interactivity_pointer: pointer, view: requestModal({}, null) }, token);
    }
  }

  return async () => {
    if (!executionId) return;
    if (opened.ok) {
      await slack("functions.completeSuccess", { function_execution_id: executionId, outputs: {} }, token);
    } else {
      await slack(
        "functions.completeError",
        { function_execution_id: executionId, error: `Couldn't open the recap form (${opened.error})` },
        token,
      );
    }
  };
}
