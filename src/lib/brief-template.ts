export type BriefType =
  | "Videographer Brief"
  | "Editor Brief"
  | "Athlete Brief"
  | "Creative Brief"
  | "Run-of-Show"
  | "Campaign Overview";

export interface CustomSection {
  id: string;
  title: string;
  content: string;
}

export interface BriefFields {
  title: string;
  clientName: string;
  badgeText: string;
  briefType: BriefType;
  shootDate: string;
  location: string;
  athletes: string;
  objective: string;
  deliverables: string;
  creativeDirection: string;
  platformNotes: string;
  cameraTechnical: string;
  dos: string;
  donts: string;
  workflow: string;
  fileDelivery: string;
  customSections: CustomSection[];
}

export const BRIEF_TYPES: BriefType[] = [
  "Videographer Brief",
  "Editor Brief",
  "Athlete Brief",
  "Creative Brief",
  "Run-of-Show",
  "Campaign Overview",
];

export interface BriefTemplate {
  name: string;
  briefType: BriefType;
  badgeText: string;
  coreFields: (keyof BriefFields)[];
  customSections: { title: string; content: string }[];
  prefillFields?: Partial<Omit<BriefFields, "customSections" | "briefType" | "badgeText">>;
}

export const SYSTEM_TEMPLATES: BriefTemplate[] = [
  {
    name: "Raising Cane's Tunnel Walk",
    briefType: "Videographer Brief",
    badgeText: "Videographer Creative Brief",
    coreFields: ["objective", "deliverables", "creativeDirection", "cameraTechnical", "dos", "donts", "workflow", "fileDelivery"],
    prefillFields: {
      clientName: "Raising Cane's",
      objective: "Athletes stage a pre-game tunnel walk as they arrive for the game. Each athlete walks through the tunnel carrying Raising Cane's product while wearing a Raising Cane's hat, capturing the energy and swagger of a game-day arrival — fueled by Cane's.\n\nSame-Day Delivery of Content Is Mandatory — All photos and video footage must be uploaded and delivered to Postgame the same day as the shoot. There are no exceptions to this policy.",
      deliverables: "VIDEO (Required)\n- 1x Tunnel Walk Video — athlete walking through tunnel or getting off the bus. Shot in slo-mo or standard rate.\n- Shot in horizontal, framed for vertical (9:16) — keep subjects centered so nothing is lost in the crop\n- Deliver both: raw slow-mo clips + edited final cut\n\nPHOTOGRAPHY (Required)\n- Minimum 15–25 photos\n- Mix of mid-stride action and posed with product",
      creativeDirection: "Overall Tone: Confident & Game-Ready, Clean & Cinematic, Swagger & Energy\n\n- Think NFL Draft night arrivals or NBA tunnel fits energy\n- Low angle shots to make the athlete look powerful and commanding\n- Shallow depth of field to separate the athlete from the background\n- Use the tunnel environment — lighting, walls, depth — to create atmosphere\n- The Cane's product should feel like a natural extension of the athlete's swagger, not a forced prop\n\nLighting Notes:\n- If the tunnel is dark, bring a portable LED panel for fill light\n- Dramatic lighting is great — use shadows to your advantage\n- Make sure the product (bag/cup) and hat are well-lit and visible",
      cameraTechnical: "VIDEO\n- Frame Rate: 60fps / 120fps for slow-motion\n- Resolution: 4K preferred, 1080p minimum\n- Orientation: Shot in horizontal, framed for vertical (9:16)\n- Stabilization: Gimbal or tripod — no handheld shake\n- Color Profile: S-Log — all video must be shot in S-Log for maximum flexibility in post\n\nPHOTOGRAPHY\n- Shoot in RAW + JPEG\n- Fast shutter speed to freeze motion — min 1/500\n- Wide aperture (f/1.4 – f/2.8) for cinematic separation\n- Burst mode during the walk to capture peak moments\n- Lens Recommendation: 35mm or 50mm for tight tunnel environments. 70–200mm if you have distance.",
      workflow: "1. Arrive Early & Scout Location — Get to the tunnel at least 45 minutes early. Walk the path, identify best angles, check lighting, set up additional lights. Call your Postgame contact to verify the location for approval.\n2. Prep the Product — Ensure the Cane's bag is uncreased and pristine. Cup has lid + straw. Have backups ready. Hat should be clean and ready.\n3. Brief the Athlete — Quick 2-minute rundown: walk path, speed (slow and confident), where to look, how to hold product. Show them a reference video. NO OTHER LOGOS on clothing.\n4. Capture the Walk (Video) — Record in slow-mo and standard rate. Run it 2–3 times minimum from different angles. Get at least one take from the front, one from the side, and one from behind.\n5. Capture Photos — Shoot during the walks and grab a few posed shots in the tunnel with the product. Mix candid mid-stride shots with intentional portraits.\n6. Review & Wrap — Quickly review footage on-site to ensure product visibility, hat placement, and overall quality. Reshoot if anything is off.",
      fileDelivery: "VIDEO FILES\n- Format: .MOV or .MP4 (H.264 or H.265)\n- Resolution: 4K preferred, 1080p minimum\n- Color Profile: Shot in S-Log\n- Deliver both: Raw slow-mo clips + edited final cut\n\nPHOTO FILES\n- Format: High-res JPEG + RAW files\n- Color grading: Clean, natural edit — no heavy filters\n\nDELIVERY METHOD\n- Upload to shared Google Drive link in run of show\n- Organize into subfolders: /Photos and /Video\n- Same-day upload is mandatory — no exceptions\n- A run of show will be provided by Postgame prior to shoot day",
      dos: "Make the athlete look like a star arriving for the big game\nKeep the Cane's bag uncreased and looking fresh\nEnsure the cup has both straw and lid visible\nUse the tunnel environment for cinematic depth\nShoot multiple takes from multiple angles\nUse backup product if dented or creased\nUse slow motion for the hero video\nMake sure the hat fits well, faces forward, and looks intentional\nGet both wide and tight shots\nShoot in S-Log",
      donts: "Use a creased, wrinkled, or grease-stained bag\nFilm with a cup that's missing the straw or lid\nLet competing brand logos appear in frame\nShoot handheld without stabilization\nRush — take the time to get it right\nLet the product look like an afterthought\nFilm in poor lighting without supplemental light\nForget to check hat placement before rolling\nDeliver shaky or out-of-focus footage\nDeliver content late — same-day upload is mandatory",
    },
    customSections: [
      {
        title: "Product Requirements",
        content: "RAISING CANE'S BAG\n- Bag must be uncreased — fresh out of the box, not wrinkled or folded\n- Bag should be held naturally and CANE'S Logos should be visible and prominent in frame\n- No grease stains, tears, or damage to the bag\n- If needed, stuff the bag lightly so it holds its shape on camera\n\nRAISING CANE'S CUP\n- Cup must have both the straw and lid in place\n- Cup should be full or appear full — no crushed or dented cups\n- Straw should be upright and visible\n- Cup branding should face the camera",
      },
      {
        title: "Athlete Requirements",
        content: "- Athlete must wear a Raising Cane's hat during the tunnel walk — the hat must be facing forward\n- Athlete must have a Cane's bag or cup in hand (or both)\n- Outfit should be game-day ready — clean, styled, confident\n- No competing brand logos visible (hats, shirts, accessories)\n- Athlete should walk with energy and swagger — this is their moment\n\nHat Check: Make sure the Raising Cane's hat is fitted properly, facing forward, and looks good on camera before rolling. Adjust the angle if needed.",
      },
    ],
  },
  {
    name: "Videographer Brief",
    briefType: "Videographer Brief",
    badgeText: "Videographer Creative Brief",
    coreFields: ["objective", "deliverables", "creativeDirection", "cameraTechnical", "workflow", "fileDelivery"],
    customSections: [],
  },
  {
    name: "Editor Brief",
    briefType: "Editor Brief",
    badgeText: "Editor Creative Brief",
    coreFields: ["objective", "deliverables"],
    customSections: [
      { title: "Edit Structure", content: "" },
      { title: "Music & Tone", content: "" },
      { title: "Export Specs", content: "" },
      { title: "Athlete Priority", content: "" },
    ],
  },
  {
    name: "Athlete Brief",
    briefType: "Athlete Brief",
    badgeText: "Athlete Content Brief",
    coreFields: ["objective", "deliverables"],
    customSections: [
      { title: "Campaign Talking Points", content: "" },
      { title: "Wardrobe & Props", content: "" },
      { title: "Posting Instructions", content: "" },
      { title: "Content Restrictions", content: "" },
    ],
  },
  {
    name: "Creative Brief",
    briefType: "Creative Brief",
    badgeText: "Creative Brief",
    coreFields: ["objective"],
    customSections: [
      { title: "Target Audience", content: "" },
      { title: "Key Message", content: "" },
      { title: "Visual Direction", content: "" },
      { title: "Timeline", content: "" },
    ],
  },
  {
    name: "Run-of-Show",
    briefType: "Run-of-Show",
    badgeText: "Run of Show",
    coreFields: [],
    customSections: [
      { title: "Pre-Event", content: "" },
      { title: "Main Coverage", content: "" },
      { title: "Athlete Moments", content: "" },
      { title: "Postgame", content: "" },
      { title: "Contacts", content: "" },
    ],
  },
  {
    name: "Campaign Overview",
    briefType: "Campaign Overview",
    badgeText: "Campaign Overview",
    coreFields: ["objective"],
    customSections: [
      { title: "Campaign Goals", content: "" },
      { title: "Deliverables by Phase", content: "" },
      { title: "Timeline", content: "" },
      { title: "Brand Guidelines", content: "" },
    ],
  },
];

export const EMPTY_FIELDS: BriefFields = {
  title: "",
  clientName: "",
  badgeText: "Videographer Creative Brief",
  briefType: "Videographer Brief",
  shootDate: "",
  location: "",
  athletes: "",
  objective: "",
  deliverables: "",
  creativeDirection: "",
  platformNotes: "",
  cameraTechnical: "",
  dos: "",
  donts: "",
  workflow: "",
  fileDelivery: "",
  customSections: [],
};

export function applyTemplate(template: BriefTemplate, existingTitle?: string, existingClient?: string): BriefFields {
  return {
    ...EMPTY_FIELDS,
    ...(template.prefillFields || {}),
    title: existingTitle || "",
    clientName: existingClient || template.prefillFields?.clientName || "",
    briefType: template.briefType,
    badgeText: template.badgeText,
    customSections: template.customSections.map((s, i) => ({
      id: `cs-${i}-${Date.now()}`,
      title: s.title,
      content: s.content,
    })),
  };
}

export function generateBriefHTML(fields: BriefFields): string {
  const sections: string[] = [];
  let num = 1;

  if (fields.objective.trim()) {
    sections.push(sectionHTML(num++, "Objective", paraHTML(fields.objective)));
  }
  if (fields.deliverables.trim()) {
    sections.push(sectionHTML(num++, "Required Deliverables", bulletHTML(fields.deliverables)));
  }
  if (fields.creativeDirection.trim()) {
    sections.push(sectionHTML(num++, "Creative Direction", bulletHTML(fields.creativeDirection)));
  }
  if (fields.platformNotes.trim()) {
    sections.push(sectionHTML(num++, "Platform & Posting", bulletHTML(fields.platformNotes)));
  }
  if (fields.cameraTechnical.trim()) {
    sections.push(sectionHTML(num++, "Camera & Technical", bulletHTML(fields.cameraTechnical)));
  }
  if (fields.workflow.trim()) {
    sections.push(sectionHTML(num++, "Shoot Workflow", bulletHTML(fields.workflow)));
  }
  if (fields.dos.trim() || fields.donts.trim()) {
    sections.push(sectionHTML(num++, "Do's & Don'ts", dosAndDontsHTML(fields.dos, fields.donts)));
  }
  if (fields.fileDelivery.trim()) {
    sections.push(sectionHTML(num++, "File Delivery", bulletHTML(fields.fileDelivery)));
  }

  for (const cs of fields.customSections) {
    if (cs.content.trim() || cs.title.trim()) {
      sections.push(sectionHTML(num++, cs.title || "Section", smartContentHTML(cs.content)));
    }
  }

  const metaItems: string[] = [];
  if (fields.shootDate) metaItems.push(metaItem("Date", fields.shootDate));
  if (fields.location) metaItems.push(metaItem("Location", fields.location));
  if (fields.athletes) metaItems.push(metaItem("Talent", fields.athletes));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(fields.title)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f0eb;color:#1a1a1a;line-height:1.6}
.hero{background:#1a1a1a;color:white;padding:60px 40px;text-align:center}
.hero .badge{display:inline-block;background:#D73F09;color:white;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;padding:6px 16px;border-radius:20px;margin-bottom:24px}
.hero h1{font-size:32px;font-weight:900;margin-bottom:8px}
.hero .subtitle{color:#999;font-size:14px}
.meta-bar{background:#222;padding:20px 40px;display:flex;justify-content:center;gap:48px;flex-wrap:wrap}
.meta-item label{display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#666;margin-bottom:3px}
.meta-item p{font-size:14px;color:#ccc;font-weight:500}
.container{max-width:800px;margin:0 auto;padding:40px 24px}
.section{background:white;border-radius:16px;padding:32px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
.section-header{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.section-num{background:#D73F09;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0}
.section-title{font-size:20px;font-weight:800}
.section p{font-size:15px;color:#444;margin-bottom:12px}
.section ul{list-style:none;padding:0}
.section li{position:relative;padding-left:20px;margin-bottom:10px;font-size:15px;color:#444}
.section li::before{content:"";position:absolute;left:0;top:8px;width:8px;height:8px;background:#D73F09;border-radius:50%}
.dos-donts{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.dos-col h3{color:#16a34a;font-size:16px;font-weight:700;margin-bottom:12px}
.donts-col h3{color:#dc2626;font-size:16px;font-weight:700;margin-bottom:12px}
.dos-col li::before{background:#16a34a}
.donts-col li::before{background:#dc2626}
.footer{text-align:center;padding:40px;color:#999;font-size:13px}
.footer span{color:#D73F09;font-weight:700}
@media(max-width:600px){.hero{padding:40px 20px}.hero h1{font-size:24px}.section{padding:24px}.dos-donts{grid-template-columns:1fr}.meta-bar{gap:24px}}
</style>
</head>
<body>
<div class="hero">
  <div class="badge">${esc(fields.badgeText || fields.briefType || "Creative Brief")}</div>
  <h1>${esc(fields.title)}</h1>
  <div class="subtitle">${esc(fields.clientName)} × Postgame</div>
</div>
${metaItems.length > 0 ? `<div class="meta-bar">${metaItems.join("\n")}</div>` : ""}
<div class="container">
${sections.join("\n")}
</div>
<div class="footer">Built with <span>Postgame</span> Page Creator</div>
</body>
</html>`;
}

function metaItem(label: string, value: string): string {
  return `<div class="meta-item"><label>${esc(label)}</label><p>${esc(value)}</p></div>`;
}

function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sectionHTML(num: number, title: string, content: string): string {
  return `<div class="section">
  <div class="section-header">
    <div class="section-num">${num}</div>
    <div class="section-title">${esc(title)}</div>
  </div>
  ${content}
</div>`;
}

function paraHTML(text: string): string {
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => `<p>${esc(l.trim())}</p>`)
    .join("\n  ");
}

function bulletHTML(text: string): string {
  const items = text
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  if (items.length === 0) return "";
  return `<ul>\n${items.map((i) => `    <li>${esc(i)}</li>`).join("\n")}\n  </ul>`;
}

function smartContentHTML(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const isBullet = lines.some((l) => /^[-•*]/.test(l));
  return isBullet ? bulletHTML(text) : paraHTML(text);
}

function dosAndDontsHTML(dos: string, donts: string): string {
  const doItems = dos
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  const dontItems = donts
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  return `<div class="dos-donts">
    <div class="dos-col">
      <h3>DO</h3>
      <ul>${doItems.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
    </div>
    <div class="donts-col">
      <h3>DON'T</h3>
      <ul>${dontItems.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
    </div>
  </div>`;
}
