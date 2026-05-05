import fs from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import PostgameCalendar from "@/components/PostgameCalendar";

// Render at request time so we always pick up edits to the static
// crocs-pitch.html file without needing a rebuild.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Postgame × Crocs",
  description: "A pitch from Postgame.",
};

// Read the existing static Crocs pitch HTML, split it at the
// <!-- POSTGAME_CALENDAR_PLACEHOLDER --> marker, and inject the
// React PostgameCalendar component at that spot.
async function loadPitchHtml() {
  const filePath = path.join(process.cwd(), "public", "crocs-pitch.html");
  const html = await fs.readFile(filePath, "utf8");

  // 1. Pull out the main <style> block from <head> (the long one that
  //    starts at line 10 in the source file). We render this as an
  //    inline <style> tag so the page's design tokens, fonts, etc.
  //    apply correctly.
  const headStyleMatch = html.match(
    /<head>[\s\S]*?<style>([\s\S]*?)<\/style>[\s\S]*?<\/head>/,
  );
  const styleContent = headStyleMatch ? headStyleMatch[1] : "";

  // 2. Extract the inner body content — everything between <body>
  //    and the first trailing <script> tag near the bottom of the
  //    file (the original HTML's IntersectionObserver reveal script
  //    is truncated and Cloudflare-specific, so we skip it).
  const bodyStartIdx = html.indexOf("<body>");
  const bodyContentStart =
    bodyStartIdx >= 0 ? bodyStartIdx + "<body>".length : 0;
  const trailingScriptIdx = html.indexOf("<script", bodyContentStart);
  const innerBody = html.slice(
    bodyContentStart,
    trailingScriptIdx > -1 ? trailingScriptIdx : html.length,
  );

  // 3. Split at the placeholder where the calendar should land
  //    (we replaced the College World Series logo with this comment).
  const [beforeRaw, afterRaw = ""] = innerBody.split(
    "<!-- POSTGAME_CALENDAR_PLACEHOLDER -->",
  );

  return {
    styleContent,
    before: beforeRaw,
    after: afterRaw,
  };
}

export default async function CrocsPitchPage() {
  const { styleContent, before, after } = await loadPitchHtml();

  return (
    <>
      {/* Google Fonts used by the Crocs page (Bebas Neue + Inter + JetBrains Mono). */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin=""
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap"
        rel="stylesheet"
      />

      {/* Inline the page's design CSS so all the existing class names
          (.hero, .bucket, .recent, .cta, etc.) keep working. */}
      <style dangerouslySetInnerHTML={{ __html: styleContent }} />

      {/* Top half of the static page: nav, hero, reactive, pros,
          March Madness, In-Store, and the start of the CTA section
          up to the calendar placeholder. */}
      <div dangerouslySetInnerHTML={{ __html: before }} />

      {/* The shared PostgameCalendar that lives at the bottom of every
          recap, now sitting in the spot where the College World Series
          logo used to be. */}
      <PostgameCalendar />

      {/* Bottom half: the rest of the CTA (Postgame × Crocs lockup,
          email button) and the footer. */}
      <div dangerouslySetInnerHTML={{ __html: after }} />
    </>
  );
}
