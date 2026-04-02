"use client";

import { useEffect, useState, useRef } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import Link from "next/link";

const C = {
  bg:"#000",surface:"#0f0f0f",surface2:"#161616",
  border:"rgba(255,255,255,0.08)",border2:"rgba(255,255,255,0.13)",
  orange:"#D73F09",text:"#fff",text2:"rgba(255,255,255,0.6)",text3:"rgba(255,255,255,0.35)",
};

const S = {
  page:{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"Arial,sans-serif"} as const,
  header:{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"14px 28px",display:"flex",alignItems:"center",justifyContent:"space-between"} as const,
  body:{display:"grid",gridTemplateColumns:"280px 1fr 340px",height:"calc(100vh - 53px)"} as const,
  panel:{background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column" as const,overflow:"hidden"},
  panelHead:{padding:"16px 16px 10px",borderBottom:`1px solid ${C.border}`,fontSize:11,fontWeight:800,textTransform:"uppercase" as const,letterSpacing:"0.12em",color:C.text3},
  panelBody:{flex:1,overflowY:"auto" as const,padding:10},
  editor:{display:"flex",flexDirection:"column" as const,overflow:"hidden"},
  editorHead:{padding:"14px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:12,alignItems:"center"} as const,
  editorBody:{flex:1,overflowY:"auto" as const,padding:24,background:"#0a0a0a"},
  card:{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,padding:20,marginBottom:10},
  label:{display:"block",fontSize:11,fontWeight:700,color:C.text3,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:5},
  input:{width:"100%",padding:"9px 12px",background:"#1a1a1a",border:`1px solid ${C.border2}`,borderRadius:8,color:C.text,fontSize:13,fontFamily:"Arial,sans-serif",outline:"none",boxSizing:"border-box" as const},
  textarea:{width:"100%",padding:"9px 12px",background:"#1a1a1a",border:`1px solid ${C.border2}`,borderRadius:8,color:C.text,fontSize:13,fontFamily:"Arial,sans-serif",outline:"none",minHeight:80,resize:"vertical" as const,boxSizing:"border-box" as const},
  btnOrange:{padding:"9px 20px",background:C.orange,border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer",textTransform:"uppercase" as const,letterSpacing:"0.06em"},
  btnGhost:{padding:"8px 16px",border:`1px solid ${C.border2}`,borderRadius:8,background:"none",color:C.text2,fontSize:12,fontWeight:700,cursor:"pointer"},
  btnAdd:{padding:"7px 14px",borderRadius:8,border:`1px dashed ${C.border2}`,background:"none",color:C.text3,fontSize:12,fontWeight:700,cursor:"pointer",width:"100%",marginTop:8},
  btnDanger:{padding:"5px 10px",borderRadius:6,border:"1px solid rgba(255,80,80,0.25)",background:"none",color:"#ff6b6b",fontSize:11,fontWeight:700,cursor:"pointer"},
  listItem:(active:boolean)=>({padding:"10px 12px",borderRadius:8,cursor:"pointer",background:active?"rgba(215,63,9,0.1)":"transparent",border:`1px solid ${active?"rgba(215,63,9,0.25)":"transparent"}`,marginBottom:4}),
  toast:{position:"fixed" as const,bottom:24,right:24,background:C.surface2,border:`1px solid ${C.orange}`,borderRadius:10,padding:"10px 20px",color:C.orange,fontSize:13,fontWeight:700,zIndex:99999},
};

interface Block {
  id: string;
  type: "header"|"text"|"image"|"button"|"divider"|"columns"|"spacer";
  content: Record<string,string>;
}

interface Newsletter {
  id: string;
  title: string;
  subject: string;
  preview_text: string;
  brand_id?: string;
  brand_color: string;
  brand_logo?: string;
  blocks: Block[];
  created_at: string;
  updated_at: string;
}

const DEFAULT_BRAND_COLOR = "#D73F09";

function newBlock(type: Block["type"]): Block {
  const id = Math.random().toString(36).slice(2);
  const defaults: Record<Block["type"], Record<string,string>> = {
    header:  { text:"Your Headline Here", size:"36", align:"center", color:"#ffffff", bg:"#0a0a0a" },
    text:    { text:"Your message here. Write clearly and keep it scannable.", align:"left", color:"#cccccc", size:"16" },
    image:   { url:"", alt:"", link:"", width:"100%" },
    button:  { text:"Click Here", url:"", bg:"#D73F09", color:"#ffffff", align:"center" },
    divider: { color:"rgba(255,255,255,0.1)", spacing:"24" },
    columns: { left:"Left column text", right:"Right column text", color:"#cccccc" },
    spacer:  { height:"32" },
  };
  return { id, type, content: defaults[type] };
}

function generateMailchimpHTML(nl: Newsletter): string {
  const bg = "#0a0a0a";
  const brandColor = nl.brand_color || DEFAULT_BRAND_COLOR;

  const renderBlock = (b: Block): string => {
    const { content: c } = b;
    switch (b.type) {
      case "header":
        return `<tr><td align="${c.align||"center"}" style="background:${c.bg||bg};padding:32px 40px;">
          <h1 style="font-family:Arial,sans-serif;font-size:${c.size||36}px;color:${c.color||"#fff"};margin:0;line-height:1.2;">${c.text}</h1>
        </td></tr>`;
      case "text":
        return `<tr><td style="padding:16px 40px;background:${bg};">
          <p style="font-family:Arial,sans-serif;font-size:${c.size||16}px;line-height:1.6;color:${c.color||"#ccc"};margin:0;text-align:${c.align||"left"};">${c.text.replace(/\n/g,"<br/>")}</p>
        </td></tr>`;
      case "image":
        return c.url ? `<tr><td align="center" style="padding:16px 40px;background:${bg};">
          ${c.link ? `<a href="${c.link}">` : ""}<img src="${c.url}" alt="${c.alt||""}" style="max-width:100%;width:${c.width||"100%"};display:block;" />${c.link ? "</a>" : ""}
        </td></tr>` : "";
      case "button":
        return `<tr><td align="${c.align||"center"}" style="padding:20px 40px;background:${bg};">
          <a href="${c.url||"#"}" style="display:inline-block;padding:14px 32px;background:${c.bg||brandColor};color:${c.color||"#fff"};font-family:Arial,sans-serif;font-size:14px;font-weight:800;text-decoration:none;border-radius:8px;text-transform:uppercase;letter-spacing:0.06em;">${c.text}</a>
        </td></tr>`;
      case "divider":
        return `<tr><td style="padding:${c.spacing||24}px 40px;background:${bg};"><hr style="border:none;border-top:1px solid ${c.color||"rgba(255,255,255,0.1)"};margin:0;" /></td></tr>`;
      case "columns":
        return `<tr><td style="padding:16px 40px;background:${bg};">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td width="48%" style="font-family:Arial,sans-serif;font-size:15px;color:${c.color||"#ccc"};padding-right:16px;vertical-align:top;">${c.left}</td>
            <td width="4%"></td>
            <td width="48%" style="font-family:Arial,sans-serif;font-size:15px;color:${c.color||"#ccc"};vertical-align:top;">${c.right}</td>
          </tr></table>
        </td></tr>`;
      case "spacer":
        return `<tr><td style="height:${c.height||32}px;background:${bg};"></td></tr>`;
      default: return "";
    }
  };

  const logoRow = nl.brand_logo ? `<tr><td align="center" style="padding:24px 40px 0;background:${bg};">
    <img src="${nl.brand_logo}" alt="Logo" style="height:40px;width:auto;display:block;margin:0 auto;" />
  </td></tr>` : `<tr><td align="center" style="padding:24px 40px 0;background:${bg};">
    <div style="font-family:Arial,sans-serif;font-size:20px;font-weight:900;color:${brandColor};letter-spacing:0.06em;">POSTGAME</div>
  </td></tr>`;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${nl.subject}</title></head>
<body style="margin:0;padding:0;background:#1a1a1a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;">
  <tr><td align="center" style="padding:24px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${bg};border-radius:12px;overflow:hidden;">
      ${logoRow}
      ${nl.blocks.map(renderBlock).join("\n      ")}
      <tr><td style="padding:32px 40px;background:#050505;border-top:1px solid rgba(255,255,255,0.06);">
        <p style="font-family:Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.3);margin:0;text-align:center;line-height:1.6;">
          &copy; ${new Date().getFullYear()} Postgame &mdash; The #1 NIL Agency<br/>
          <a href="*|UNSUB|*" style="color:rgba(255,255,255,0.3);">Unsubscribe</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function BlockEditor({ block, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast }: {
  block: Block; onChange: (b: Block) => void; onDelete: () => void;
  onMoveUp: () => void; onMoveDown: () => void; isFirst: boolean; isLast: boolean;
}) {
  const upd = (k: string, v: string) => onChange({ ...block, content: { ...block.content, [k]: v } });
  const [open, setOpen] = useState(true);

  const typeLabel: Record<Block["type"],string> = {
    header:"Headline", text:"Text", image:"Image", button:"Button",
    divider:"Divider", columns:"Two Columns", spacer:"Spacer"
  };

  return (
    <div style={{ background:"#111", border:`1px solid ${C.border}`, borderRadius:12, marginBottom:10, overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", padding:"10px 14px", cursor:"pointer", gap:10 }} onClick={()=>setOpen(o=>!o)}>
        <span style={{ fontSize:11, fontWeight:800, textTransform:"uppercase" as const, letterSpacing:"0.1em", color:C.text3, flex:1 }}>{typeLabel[block.type]}</span>
        <div style={{ display:"flex", gap:4 }}>
          {!isFirst && <button style={S.btnGhost} onClick={e=>{e.stopPropagation();onMoveUp();}}>↑</button>}
          {!isLast && <button style={S.btnGhost} onClick={e=>{e.stopPropagation();onMoveDown();}}>↓</button>}
          <button style={S.btnDanger} onClick={e=>{e.stopPropagation();onDelete();}}>✕</button>
        </div>
        <span style={{ color:C.text3, fontSize:12 }}>{open?"▲":"▼"}</span>
      </div>

      {open && (
        <div style={{ padding:"0 14px 14px", borderTop:`1px solid ${C.border}` }}>
          {block.type === "header" && <>
            <div style={{ marginTop:12 }}><label style={S.label}>Headline Text</label><textarea style={S.textarea} value={block.content.text} onChange={e=>upd("text",e.target.value)} /></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:10 }}>
              <div><label style={S.label}>Font Size (px)</label><input style={S.input} value={block.content.size} onChange={e=>upd("size",e.target.value)} /></div>
              <div><label style={S.label}>Align</label>
                <select style={S.input} value={block.content.align} onChange={e=>upd("align",e.target.value)}>
                  <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
                </select>
              </div>
              <div><label style={S.label}>Text Color</label><input style={S.input} type="color" value={block.content.color} onChange={e=>upd("color",e.target.value)} /></div>
              <div><label style={S.label}>Background</label><input style={S.input} type="color" value={block.content.bg||"#0a0a0a"} onChange={e=>upd("bg",e.target.value)} /></div>
            </div>
          </>}

          {block.type === "text" && <>
            <div style={{ marginTop:12 }}><label style={S.label}>Text Content</label><textarea style={{ ...S.textarea, minHeight:120 }} value={block.content.text} onChange={e=>upd("text",e.target.value)} /></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginTop:10 }}>
              <div><label style={S.label}>Size (px)</label><input style={S.input} value={block.content.size} onChange={e=>upd("size",e.target.value)} /></div>
              <div><label style={S.label}>Color</label><input style={S.input} type="color" value={block.content.color} onChange={e=>upd("color",e.target.value)} /></div>
              <div><label style={S.label}>Align</label>
                <select style={S.input} value={block.content.align} onChange={e=>upd("align",e.target.value)}>
                  <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
                </select>
              </div>
            </div>
          </>}

          {block.type === "image" && <>
            <div style={{ marginTop:12 }}><label style={S.label}>Image URL</label><input style={S.input} value={block.content.url} onChange={e=>upd("url",e.target.value)} placeholder="https://..." /></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:10 }}>
              <div><label style={S.label}>Alt Text</label><input style={S.input} value={block.content.alt} onChange={e=>upd("alt",e.target.value)} /></div>
              <div><label style={S.label}>Link URL</label><input style={S.input} value={block.content.link} onChange={e=>upd("link",e.target.value)} placeholder="https://..." /></div>
            </div>
          </>}

          {block.type === "button" && <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:12 }}>
              <div><label style={S.label}>Button Text</label><input style={S.input} value={block.content.text} onChange={e=>upd("text",e.target.value)} /></div>
              <div><label style={S.label}>Button URL</label><input style={S.input} value={block.content.url} onChange={e=>upd("url",e.target.value)} placeholder="https://..." /></div>
              <div><label style={S.label}>Background</label><input style={S.input} type="color" value={block.content.bg} onChange={e=>upd("bg",e.target.value)} /></div>
              <div><label style={S.label}>Text Color</label><input style={S.input} type="color" value={block.content.color} onChange={e=>upd("color",e.target.value)} /></div>
            </div>
          </>}

          {block.type === "columns" && <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:12 }}>
              <div><label style={S.label}>Left Column</label><textarea style={S.textarea} value={block.content.left} onChange={e=>upd("left",e.target.value)} /></div>
              <div><label style={S.label}>Right Column</label><textarea style={S.textarea} value={block.content.right} onChange={e=>upd("right",e.target.value)} /></div>
            </div>
            <div style={{ marginTop:10 }}><label style={S.label}>Text Color</label><input style={S.input} type="color" value={block.content.color} onChange={e=>upd("color",e.target.value)} /></div>
          </>}

          {block.type === "divider" && <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:12 }}>
              <div><label style={S.label}>Spacing (px)</label><input style={S.input} value={block.content.spacing} onChange={e=>upd("spacing",e.target.value)} /></div>
              <div><label style={S.label}>Line Color</label><input style={S.input} type="color" value={block.content.color||"#222"} onChange={e=>upd("color",e.target.value)} /></div>
            </div>
          </>}

          {block.type === "spacer" && (
            <div style={{ marginTop:12 }}><label style={S.label}>Height (px)</label><input style={S.input} value={block.content.height} onChange={e=>upd("height",e.target.value)} /></div>
          )}
        </div>
      )}
    </div>
  );
}

const BLOCK_TYPES: { type: Block["type"]; label: string; icon: string }[] = [
  { type:"header",  label:"Headline",    icon:"H" },
  { type:"text",    label:"Text",        icon:"¶" },
  { type:"image",   label:"Image",       icon:"🖼" },
  { type:"button",  label:"Button",      icon:"⬜" },
  { type:"columns", label:"2 Columns",   icon:"⬛⬛" },
  { type:"divider", label:"Divider",     icon:"—" },
  { type:"spacer",  label:"Spacer",      icon:"↕" },
];

export default function NewsletterPage() {
  const supabase = createBrowserSupabase();
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [active, setActive] = useState<Newsletter | null>(null);
  const [brands, setBrands] = useState<{id:string;name:string;logo_url:string;primary_color:string}[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [showExport, setShowExport] = useState(false);
  const htmlRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadNewsletters();
    supabase.from("brands").select("id,name,logo_url,primary_color").eq("archived",false).order("name").then(({data}) => setBrands((data||[]) as any));
  }, []);

  async function loadNewsletters() {
    const { data } = await supabase.from("newsletters").select("*").order("created_at",{ascending:false});
    setNewsletters((data||[]) as Newsletter[]);
    if (data && data.length > 0 && !active) setActive(data[0] as Newsletter);
  }

  async function createNewsletter() {
    const { data } = await supabase.from("newsletters").insert({
      title: "New Newsletter",
      subject: "Subject Line",
      preview_text: "",
      brand_color: DEFAULT_BRAND_COLOR,
      blocks: [newBlock("header"), newBlock("text"), newBlock("button")],
    }).select().single();
    if (data) { setNewsletters(p => [data as Newsletter, ...p]); setActive(data as Newsletter); }
  }

  async function save() {
    if (!active) return;
    setSaving(true);
    await supabase.from("newsletters").update({
      title: active.title, subject: active.subject, preview_text: active.preview_text,
      brand_color: active.brand_color, brand_logo: active.brand_logo,
      blocks: active.blocks, updated_at: new Date().toISOString(),
    }).eq("id", active.id);
    setSaving(false);
    setToast("Saved ✓");
    setTimeout(() => setToast(""), 2000);
    loadNewsletters();
  }

  async function deleteNewsletter(id: string) {
    if (!confirm("Delete this newsletter?")) return;
    await supabase.from("newsletters").delete().eq("id", id);
    setNewsletters(p => p.filter(n => n.id !== id));
    setActive(newsletters.find(n => n.id !== id) || null);
  }

  const updateActive = (changes: Partial<Newsletter>) => setActive(p => p ? { ...p, ...changes } : null);

  const addBlock = (type: Block["type"]) => {
    if (!active) return;
    updateActive({ blocks: [...active.blocks, newBlock(type)] });
  };

  const updateBlock = (i: number, b: Block) => {
    if (!active) return;
    const blocks = [...active.blocks]; blocks[i] = b;
    updateActive({ blocks });
  };

  const deleteBlock = (i: number) => {
    if (!active) return;
    updateActive({ blocks: active.blocks.filter((_,j) => j !== i) });
  };

  const moveBlock = (i: number, dir: -1|1) => {
    if (!active) return;
    const blocks = [...active.blocks];
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    updateActive({ blocks });
  };

  const exportHTML = generateMailchimpHTML(active!);

  const copyHTML = () => {
    navigator.clipboard.writeText(exportHTML);
    setToast("HTML copied to clipboard ✓");
    setTimeout(() => setToast(""), 2500);
  };

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <Link href="/dashboard" style={{ fontSize:12, color:C.text3, textDecoration:"none", fontWeight:700 }}>← Dashboard</Link>
          <span style={{ color:C.border2 }}>|</span>
          <span style={{ fontSize:15, fontWeight:900, color:C.text }}>Newsletter Creator</span>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          {active && <>
            <button style={S.btnGhost} onClick={() => setShowExport(o=>!o)}>Export for Mailchimp</button>
            <button style={S.btnOrange} onClick={save} disabled={saving}>{saving?"Saving...":"Save"}</button>
          </>}
          <button style={S.btnOrange} onClick={createNewsletter}>+ New</button>
        </div>
      </div>

      <div style={S.body}>
        {/* Newsletter list */}
        <div style={S.panel}>
          <div style={S.panelHead}>Newsletters ({newsletters.length})</div>
          <div style={S.panelBody}>
            {newsletters.length === 0 && (
              <div style={{ padding:"24px 12px", textAlign:"center", color:C.text3, fontSize:13 }}>
                No newsletters yet.<br />Click + New to create one.
              </div>
            )}
            {newsletters.map(n => (
              <div key={n.id} style={S.listItem(active?.id === n.id)} onClick={() => setActive(n)}>
                <div style={{ fontSize:13, fontWeight:700, color: active?.id===n.id ? C.orange : C.text, marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{n.title}</div>
                <div style={{ fontSize:11, color:C.text3 }}>{n.subject}</div>
                <div style={{ fontSize:10, color:C.text3, marginTop:4 }}>{new Date(n.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div style={S.editor}>
          {!active ? (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:C.text3, fontSize:14 }}>
              Select or create a newsletter
            </div>
          ) : (
            <>
              <div style={S.editorHead}>
                <div style={{ flex:1 }}>
                  <input
                    style={{ ...S.input, fontSize:15, fontWeight:800, background:"transparent", border:"none", padding:"0", outline:"none" }}
                    value={active.title}
                    onChange={e => updateActive({ title: e.target.value })}
                    placeholder="Newsletter Title"
                  />
                </div>
                <button style={{ ...S.btnDanger, fontSize:11 }} onClick={() => deleteNewsletter(active.id)}>Delete</button>
              </div>

              <div style={S.editorBody}>
                {/* Settings */}
                <div style={S.card}>
                  <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase" as const, letterSpacing:"0.1em", color:C.text3, marginBottom:14 }}>Email Settings</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    <div>
                      <label style={S.label}>Subject Line</label>
                      <input style={S.input} value={active.subject} onChange={e=>updateActive({subject:e.target.value})} placeholder="Your subject line" />
                    </div>
                    <div>
                      <label style={S.label}>Preview Text</label>
                      <input style={S.input} value={active.preview_text||""} onChange={e=>updateActive({preview_text:e.target.value})} placeholder="Short preview text..." />
                    </div>
                    <div>
                      <label style={S.label}>Brand Color</label>
                      <input style={S.input} type="color" value={active.brand_color||DEFAULT_BRAND_COLOR} onChange={e=>updateActive({brand_color:e.target.value})} />
                    </div>
                    <div>
                      <label style={S.label}>Logo URL (optional)</label>
                      <input style={S.input} value={active.brand_logo||""} onChange={e=>updateActive({brand_logo:e.target.value})} placeholder="https://... or leave blank for POSTGAME text" />
                    </div>
                  </div>
                  {brands.length > 0 && (
                    <div style={{ marginTop:12 }}>
                      <label style={S.label}>Pull from Brand</label>
                      <select style={S.input} onChange={e => {
                        const b = brands.find(br => br.id === e.target.value);
                        if (b) updateActive({ brand_color: b.primary_color||DEFAULT_BRAND_COLOR, brand_logo: b.logo_url||"" });
                      }}>
                        <option value="">Select a brand to auto-fill...</option>
                        {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {/* Blocks */}
                <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase" as const, letterSpacing:"0.1em", color:C.text3, marginBottom:10 }}>Content Blocks</div>
                {active.blocks.map((block, i) => (
                  <BlockEditor
                    key={block.id}
                    block={block}
                    onChange={b => updateBlock(i, b)}
                    onDelete={() => deleteBlock(i)}
                    onMoveUp={() => moveBlock(i, -1)}
                    onMoveDown={() => moveBlock(i, 1)}
                    isFirst={i === 0}
                    isLast={i === active.blocks.length - 1}
                  />
                ))}

                {/* Add block */}
                <div style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:12, padding:16 }}>
                  <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase" as const, letterSpacing:"0.1em", color:C.text3, marginBottom:12 }}>Add Block</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" as const }}>
                    {BLOCK_TYPES.map(({ type, label, icon }) => (
                      <button key={type} onClick={() => addBlock(type)} style={{ padding:"8px 14px", borderRadius:8, border:`1px solid ${C.border2}`, background:"#1a1a1a", color:C.text2, fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:14 }}>{icon}</span> {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Export panel */}
        {active && showExport && (
          <div style={{ ...S.panel, borderLeft:`1px solid ${C.border}`, borderRight:"none" }}>
            <div style={{ ...S.panelHead, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span>Mailchimp Export</span>
              <button style={S.btnGhost} onClick={() => setShowExport(false)}>✕</button>
            </div>
            <div style={{ padding:16, flex:1, display:"flex", flexDirection:"column" as const, gap:12 }}>
              <div style={{ fontSize:12, lineHeight:1.6, color:C.text2 }}>
                1. Copy the HTML below<br/>
                2. In Mailchimp, create a new campaign<br/>
                3. Choose "Code your own" template<br/>
                4. Paste this HTML into the code editor
              </div>
              <button style={S.btnOrange} onClick={copyHTML}>Copy HTML to Clipboard</button>
              <textarea
                ref={htmlRef}
                readOnly
                value={exportHTML}
                style={{ ...S.textarea, flex:1, fontSize:11, fontFamily:"monospace", minHeight:0, resize:"none" as const }}
              />
            </div>
          </div>
        )}
      </div>

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}
