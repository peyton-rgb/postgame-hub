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
}

export const SYSTEM_TEMPLATES: BriefTemplate[] = [
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
    title: existingTitle || "",
    clientName: existingClient || "",
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
