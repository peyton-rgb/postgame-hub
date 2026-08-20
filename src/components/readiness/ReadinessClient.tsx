"use client";

// ============================================================
// ReadinessClient — filters + two presentations of the same data.
//
//   ≥750px  desktop table   (campaign-readiness-v25.html)
//   <750px  campaign cards  (campaign-cards-v9.html)
//
// Twelve status columns cannot fit a phone; a frozen-column table was tried and
// abandoned during design. Both presentations are driven by ONE filter
// function, so search and the Live/View-all toggle move them together.
// ============================================================

import { useMemo, useState, useEffect, useRef } from "react";
import { COLUMNS, hrefFor, campaignHref, brandHref } from "@/lib/campaign-readiness";
import type { ReadinessRow, ColumnKey, State } from "@/lib/campaign-readiness";

const LABELS: Record<ColumnKey, string> = {
  drive: "Drive", frameio: "Frame.io", kit: "Brand kit", brief: "Brand brief",
  optin: "Opt-in", instructions: "Instructions", submission: "Submission", recap: "Recap",
  clients: "Clients page", campaign: "Campaign", casestudy: "Case study", press: "Press",
};

/** Only Brand kit and Recap use status colour; everything else is link-or-dash. */
const STATUS_COLS = new Set<ColumnKey>(["kit", "recap"]);

// ── glyphs (verbatim from v25 — 21px, 1.75px stroke) ─────────────────────────
const Check = () => (
  <span className="st"><svg viewBox="0 0 24 24" fill="none" stroke="#3FB950" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.6l4.2 4.2L19 7" /></svg></span>
);
const Half = () => (
  <span className="st"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="7.2" stroke="#D29922" strokeWidth="1.75" /><path d="M12 4.8a7.2 7.2 0 0 1 0 14.4z" fill="#D29922" /></svg></span>
);
const Cross = () => (
  <span className="st"><svg viewBox="0 0 24 24" fill="none" stroke="#CF6A64" strokeWidth="1.75" strokeLinecap="round"><path d="M7.4 7.4l9.2 9.2M16.6 7.4l-9.2 9.2" /></svg></span>
);
const Chain = () => (
  <span className="lk"><svg viewBox="0 0 24 24" fill="none" stroke="#D73F09" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13.5a4.2 4.2 0 0 0 6.3.45l2.5-2.5a4.2 4.2 0 0 0-5.94-5.94l-1.43 1.42" /><path d="M14 10.5a4.2 4.2 0 0 0-6.3-.45l-2.5 2.5a4.2 4.2 0 0 0 5.94 5.94l1.42-1.42" /></svg></span>
);
const Dash = () => <span className="dsh">—</span>;

const statusGlyph = (s: State) => (s === "g" ? <Check /> : s === "y" ? <Half /> : <Cross />);
const linkGlyph = (s: State) => (s === "g" ? <Chain /> : <Dash />);
const cellGlyph = (col: ColumnKey, s: State) => (STATUS_COLS.has(col) ? statusGlyph(s) : linkGlyph(s));

const fmtScore = (n: number) => (n % 1 ? n.toFixed(1) : String(n));

export default function ReadinessClient({
  rows, liveCount, totalCount,
}: { rows: ReadinessRow[]; liveCount: number; totalCount: number }) {
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [gap, setGap] = useState("");
  const [showAll, setShowAll] = useState(false); // Live is the default view
  const [open, setOpen] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<string | null>(null);

  const brands = useMemo(
    () => [...new Set(rows.map((r) => r.brand?.name).filter((b): b is string => !!b))].sort(),
    [rows],
  );

  // ONE filter function — drives the table and the cards alike.
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      // Live filters on === true so the 20 admin_is_active-null rows stay in
      // View all rather than vanishing from both views.
      if (!showAll && !r.live) return false;
      if (needle) {
        const hay = `${r.name} ${r.brand?.name ?? ""} ${r.adminId ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (brand && r.brand?.name !== brand) return false;
      if (gap === "nodrive" && r.states.drive === "g") return false;
      if (gap === "nofio" && r.states.frameio === "g") return false;
      if (gap === "norecap" && r.states.recap !== "r") return false;
      if (gap === "kitgap" && r.kitCount === 4) return false;
      return true;
    });
  }, [rows, q, brand, gap, showAll]);

  const denom = showAll ? totalCount : liveCount;

  // Summary strip: green/amber/red split per column, over the filtered set.
  const summary = useMemo(
    () =>
      COLUMNS.map((col) => {
        let g = 0, y = 0, r = 0;
        for (const row of list) {
          const s = row.states[col];
          if (s === "g") g++; else if (s === "y") y++; else r++;
        }
        const total = Math.max(list.length, 1);
        return { col, g, y, r, gp: (g / total) * 100, yp: (y / total) * 100, rp: (r / total) * 100 };
      }),
    [list],
  );

  // The sub-header's sticky offset must equal the group row's real height.
  // Hardcoding leaves a seam that rows bleed through, and the height moves with
  // font loading and zoom — so measure it.
  const grpRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    const sync = () => {
      const h = grpRef.current?.getBoundingClientRect().height;
      if (h && h > 0) document.documentElement.style.setProperty("--hdr1", `${Math.round(h)}px`);
    };
    sync();
    addEventListener("resize", sync);
    if (document.fonts?.ready) document.fonts.ready.then(sync).catch(() => {});
    return () => removeEventListener("resize", sync);
  }, []);

  const empty = list.length === 0;
  const noneActive = !showAll && liveCount === 0;

  return (
    <div className="rdy">
      <style>{CSS}</style>
      <div className="wrap">
        <div className="head">
          <h1>Campaign Readiness</h1>
          <span className="count">{liveCount} active campaigns</span>
        </div>
        <p className="sub">
          Every icon is a link — click to open or create that item. Read live from the database;
          a field counts only when it holds real content.
        </p>

        <div className="bar2">
          <input className="search" type="search" placeholder="Search campaign, brand or ID…"
            value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" aria-label="Search campaigns" />
          <select className="sel" value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Filter by brand">
            <option value="">All brands</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select className="sel" value={gap} onChange={(e) => setGap(e.target.value)} aria-label="Filter by status">
            <option value="">Any status</option>
            <option value="nodrive">No Drive folder</option>
            <option value="nofio">No Frame.io</option>
            <option value="norecap">No recap</option>
            <option value="kitgap">Brand kit incomplete</option>
          </select>
          <div className="seg">
            <button className={showAll ? "" : "on"} onClick={() => setShowAll(false)}>Live</button>
            <button className={showAll ? "on" : ""} onClick={() => setShowAll(true)}>View all</button>
          </div>
          <span className="shown">Showing {list.length} of {denom}{showAll ? "" : " live"}</span>
        </div>

        {!empty && (
          <div className="strip" aria-hidden="true">
            {summary.map((s) => (
              <div className="scol" key={s.col} title={`${LABELS[s.col]}: ${s.g} done · ${s.y} partial · ${s.r} missing`}>
                <div className="sbar">
                  <i style={{ width: `${s.gp}%`, background: "#3FB950" }} />
                  <i style={{ width: `${s.yp}%`, background: "#D29922" }} />
                  <i style={{ width: `${s.rp}%`, background: "rgba(207,106,100,.55)" }} />
                </div>
                <span className="slab">{LABELS[s.col]}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── desktop ─────────────────────────────────────────────── */}
        <div className="tbl only-wide">
          <div className="scroll">
            <table>
              <thead>
                <tr className="grp" ref={grpRef}>
                  <th className="idc" rowSpan={2}>ID</th>
                  <th className="brandc" rowSpan={2}>Brand</th>
                  <th className="l" rowSpan={2}>Campaign</th>
                  <th className="prog" rowSpan={2}>Progress</th>
                  <th colSpan={4} className="gl">Assets</th>
                  <th colSpan={4} className="gl">Pages</th>
                  <th colSpan={4} className="gl">Website</th>
                </tr>
                <tr className="sub">
                  {COLUMNS.map((c, i) => (
                    <th key={c} className={`${i % 4 === 0 ? "gl " : ""}${c === "drive" ? "drivec" : c === "frameio" ? "fioc" : ""}`}>
                      {LABELS[c]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empty ? (
                  <tr><td colSpan={16} className="empty">
                    {noneActive ? "No campaigns are active right now." : "No campaigns match those filters."}
                  </td></tr>
                ) : (
                  list.map((r) => <Row key={r.id} r={r} />)
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── mobile ──────────────────────────────────────────────── */}
        <div className="only-narrow">
          {empty ? (
            <div className="tbl"><div className="empty">
              {noneActive ? "No campaigns are active right now." : "No campaigns match those filters."}
            </div></div>
          ) : (
            list.map((r) => (
              <Card key={r.id} r={r}
                open={open === r.id}
                onToggle={() => { setOpen(open === r.id ? null : r.id); setOpenCard(null); }}
                openCard={openCard} setOpenCard={setOpenCard} />
            ))
          )}
        </div>

        <div className="key">
          <span><Check /> Complete</span>
          <span><Half /> Partial</span>
          <span><Cross /> Nothing yet</span>
          <span><Chain /> Exists — open it</span>
          <span><Dash /> Not created</span>
          <span style={{ marginLeft: "auto" }}>Brand kit &amp; Recap use status colours · everything else is a link</span>
        </div>
      </div>
    </div>
  );
}

// ── desktop row ───────────────────────────────────────────────────────────────

function Row({ r }: { r: ReadinessRow }) {
  const pct = Math.round((r.score / COLUMNS.length) * 100);
  const recapLabel = r.states.recap === "g" ? "live" : r.states.recap === "y" ? "draft" : "";
  return (
    <tr>
      <td className="idc">
        <a className="cell start" href={campaignHref(r)} title="Open campaign">
          <span className="idn">{r.adminId ?? "—"}</span>
        </a>
      </td>
      <td className="brandc">
        <a className="cell start" href={brandHref(r)} title={r.brand ? "Open brand page" : "No brand linked"}>
          <span className="bc">
            {r.brand?.logoUrl
              ? <span className={`ico${r.brand.chip ? " chip" : ""}`}><img src={r.brand.logoUrl} alt={r.brand.name} /></span>
              : <span className="ico none" />}
            <span className="bname">{r.brand?.name ?? "no brand linked"}</span>
          </span>
        </a>
      </td>
      <td className="l">
        <a className="cell start" href={campaignHref(r)} title="Open campaign">
          <span className="cname">{r.name}</span>
        </a>
      </td>
      <td className="prog">
        <div className="score">
          <span className="track"><i style={{ width: `${pct}%` }} /></span>
          <span className="snum">{fmtScore(r.score)}/{COLUMNS.length}</span>
        </div>
      </td>
      {COLUMNS.map((c, i) => {
        const s = r.states[c];
        const external = (c === "drive" && s === "g") || (c === "frameio" && s === "g") || (c === "brief" && s === "g");
        return (
          <td key={c} className={`${i % 4 === 0 ? "gl " : ""}${c === "drive" ? "drivec" : c === "frameio" ? "fioc" : ""}`}>
            <a className="cell" href={hrefFor(c, r)} title={LABELS[c]}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
              {c === "drive"
                ? <img className={`drv${s === "g" ? "" : " off"}`} src="/google-drive-logo.png" alt="Google Drive" />
                : c === "frameio"
                  ? (s === "g" ? <img className="fio" src="/readiness/frameio.svg" alt="Frame.io" /> : <Dash />)
                  : cellGlyph(c, s)}
              {c === "kit" && <span className="frac">{r.kitCount} / 4</span>}
              {c === "recap" && recapLabel && <span className="frac">{recapLabel}</span>}
            </a>
          </td>
        );
      })}
    </tr>
  );
}

// ── mobile card ───────────────────────────────────────────────────────────────

const SECTIONS: { key: "w" | "g" | "o"; title: string; icon: string; cols: ColumnKey[] }[] = [
  { key: "w", title: "Assets", icon: "/readiness/section-assets.png", cols: ["drive", "frameio", "kit", "brief"] },
  { key: "g", title: "Campaign pages", icon: "/readiness/section-pages.png", cols: ["optin", "instructions", "submission", "recap"] },
  { key: "o", title: "Website", icon: "/readiness/section-website.png", cols: ["clients", "campaign", "casestudy", "press"] },
];

const Chevron = ({ double }: { double?: boolean }) => (
  <span className="cv"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {double ? <><path d="M6 9l6 6 6-6" /><path d="M6 4l6 6 6-6" /></> : <path d="M6 9l6 6 6-6" />}
  </svg></span>
);

function Card({
  r, open, onToggle, openCard, setOpenCard,
}: {
  r: ReadinessRow; open: boolean; onToggle: () => void;
  openCard: string | null; setOpenCard: (v: string | null) => void;
}) {
  return (
    <div className={`camp${open ? " open" : ""}`}>
      <button className="ch" onClick={onToggle} aria-expanded={open}>
        <span className="lg">
          {r.brand?.logoUrl ? <img src={r.brand.logoUrl} alt={r.brand.name} /> : null}
        </span>
        <span className="ct">
          <span className="cn">{r.name}</span>
          <span className="cm">{r.brand?.name ?? "no brand"} · {r.adminId ?? "—"}</span>
        </span>
        <span className="cc"><b>{fmtScore(r.score)}</b><span>of {COLUMNS.length}</span></span>
        <Chevron double />
      </button>

      <div className="deck">
        {SECTIONS.map((sec) => {
          const id = `${r.id}:${sec.key}`;
          const isOpen = openCard === id;
          const done = sec.cols.reduce((n, c) => n + (r.states[c] === "g" ? 1 : 0), 0);
          return (
            <div className={`sect ${sec.key}${isOpen ? " open" : ""}`} key={sec.key}>
              <button className="sh" onClick={() => setOpenCard(isOpen ? null : id)} aria-expanded={isOpen}>
                <span className="si"><img src={sec.icon} alt="" /></span>
                <span className="st2">{sec.title}</span>
                <span className="sc">{done} of {sec.cols.length}</span>
                <Chevron />
              </button>
              <div className="sb">
                {sec.cols.map((c) => {
                  const s = r.states[c];
                  const on = s === "g";
                  const badge = c === "drive" ? "/google-drive-logo.png"
                    : c === "frameio" ? "/readiness/frameio.svg"
                    : c === "kit" ? (r.brand?.logoUrl ?? "/postgame-logo-white.png")
                    : "/postgame-logo-white.png";
                  const external = on && (c === "drive" || c === "frameio" || c === "brief");
                  return (
                    <div className={`it${on ? "" : " off"}`} key={c}>
                      <span className="s">{STATUS_COLS.has(c) ? statusGlyph(s) : on ? <Check /> : <Cross />}</span>
                      <span className="bg"><img src={badge} alt="" /></span>
                      <span className="nm">
                        {LABELS[c]}
                        {c === "kit" && <i>{r.kitCount} of 4</i>}
                        {c === "recap" && s !== "r" && <i>{s === "g" ? "live" : "draft"}</i>}
                      </span>
                      <a className="go" href={hrefFor(c, r)} aria-label={`${on ? "Open" : "Create"} ${LABELS[c]}`}
                        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          {on ? <><path d="M7 17L17 7" /><path d="M8 7h9v9" /></> : <><path d="M12 5v14" /><path d="M5 12h14" /></>}
                        </svg>
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── styles (ported verbatim from v25 + v9) ────────────────────────────────────
const CSS = `
.rdy{--bg:#101014;--panel:#1B1B21;--panel2:#1F1F26;--line:rgba(255,255,255,.10);
  --grp:rgba(255,255,255,.22);--mut:rgba(255,255,255,.5);--org:#D73F09;
  background:var(--bg);color:#fff;min-height:100vh;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;font-size:14px;padding:30px 24px 70px}
.rdy *{box-sizing:border-box}
.rdy .wrap{max-width:1660px;margin:0 auto}
.rdy .head{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.rdy h1{font-size:24px;font-weight:600;letter-spacing:-.01em}
.rdy .count{font-size:13px;color:var(--mut)}
.rdy .sub{font-size:14px;color:var(--mut);margin:8px 0 22px}
.rdy .bar2{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
.rdy .search{flex:1 1 300px;min-width:220px;background:var(--panel);color:#fff;font:inherit;font-size:13px;
  border:1px solid var(--line);border-radius:8px;padding:9px 12px;outline:none}
.rdy .search::placeholder{color:rgba(255,255,255,.35)}
.rdy .search:focus{border-color:rgba(215,63,9,.65)}
.rdy .sel{background:var(--panel);color:#fff;font:inherit;font-size:13px;border:1px solid var(--line);
  border-radius:8px;padding:9px 10px;outline:none;cursor:pointer}
.rdy .seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.rdy .seg button{background:transparent;border:none;border-right:1px solid var(--line);color:var(--mut);
  font:inherit;font-size:13px;padding:9px 15px;cursor:pointer}
.rdy .seg button:last-child{border-right:none}
.rdy .seg button.on{background:rgba(255,255,255,.11);color:#fff;font-weight:600}
.rdy .shown{font-size:12.5px;color:var(--mut);margin-left:auto;white-space:nowrap}

.rdy .strip{display:flex;gap:8px;margin:0 0 14px}
.rdy .scol{flex:1;min-width:0}
.rdy .sbar{display:flex;height:5px;border-radius:99px;overflow:hidden;background:rgba(255,255,255,.09)}
.rdy .sbar i{display:block;height:100%}
.rdy .slab{display:block;font-size:9.5px;letter-spacing:.04em;text-transform:uppercase;
  color:rgba(255,255,255,.38);margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.rdy .tbl{border:1px solid var(--line);border-radius:9px;overflow:hidden;background:var(--panel)}
.rdy .scroll{max-height:calc(100vh - 250px);overflow:auto;-webkit-overflow-scrolling:touch}
.rdy .empty{padding:34px 20px;text-align:center;color:var(--mut);font-size:13.5px}
.rdy table{width:100%;border-collapse:collapse;min-width:1620px}
.rdy thead th{font-weight:600;color:var(--mut);text-align:center;background:#22222B;white-space:nowrap}
.rdy thead tr.grp th{font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;padding:12px 8px 9px;
  color:rgba(255,255,255,.62);border-bottom:1px solid rgba(255,255,255,.07)}
.rdy thead tr.sub th{font-size:11.5px;letter-spacing:.03em;text-transform:uppercase;padding:9px 8px 12px;
  border-bottom:1px solid var(--line)}
.rdy thead th.l{text-align:left;padding-left:16px}
.rdy .gl{border-left:2px solid var(--grp)!important}
/* sticky rules declared LAST so no later background overrides the solid fill */
.rdy thead tr.grp th,.rdy thead tr.sub th{position:sticky;z-index:5;background:#22222B!important}
.rdy thead tr.grp th{top:0;box-shadow:inset 0 -1px 0 var(--line)}
.rdy thead tr.sub th{top:var(--hdr1,36px);box-shadow:inset 0 -1px 0 var(--line)}
.rdy thead tr.sub th.gl,.rdy thead tr.grp th.gl{box-shadow:inset 1px 0 0 var(--grp),inset 0 -1px 0 var(--line)}

.rdy tbody td{padding:0;text-align:center;height:62px;border-bottom:1px solid rgba(255,255,255,.05);
  border-left:1px solid rgba(255,255,255,.05)}
.rdy thead th.idc{text-align:center;padding:0 10px}
.rdy tbody td.idc{text-align:center;width:84px;border-left:none}
.rdy tbody td.idc a.cell{align-items:center;justify-content:center}
.rdy thead th.brandc{text-align:left;padding-left:16px;padding-right:14px}
.rdy tbody td.brandc{text-align:left;width:210px}
.rdy tbody td.brandc a.cell{padding-left:16px;padding-right:14px}
.rdy tbody td.l{text-align:left}
.rdy tbody td.l a.cell{padding-left:16px;padding-right:16px}
.rdy a.cell.start{align-items:flex-start;justify-content:center;width:100%}
.rdy tbody td.idc a.cell.start{align-items:center}
.rdy .idn{font-size:13.5px;color:var(--mut);font-variant-numeric:tabular-nums}
.rdy .bname{font-size:13.5px;color:rgba(255,255,255,.82);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rdy tbody tr:nth-child(even){background:var(--panel2)}
.rdy tbody tr:hover{background:rgba(255,255,255,.06)}
.rdy tbody tr:last-child td{border-bottom:none}
.rdy .bc{display:flex;align-items:center;gap:11px;min-width:0}
.rdy .ico{width:40px;height:40px;flex:0 0 40px;display:flex;align-items:center;justify-content:center;
  border-radius:5px;overflow:hidden}
.rdy .ico img{max-width:100%;max-height:100%;object-fit:contain;display:block}
.rdy .ico.chip{background:#fff;padding:4px}
.rdy .ico.none{background:rgba(255,255,255,.05);border:1px dashed rgba(255,255,255,.18)}
.rdy .cname{display:block;font-size:15px;font-weight:600;line-height:1.3;color:#fff;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;max-width:330px;transition:color .12s}
.rdy td.l a.cell:hover .cname{color:#D73F09;text-decoration:underline;text-underline-offset:3px;
  text-decoration-thickness:1.5px}
.rdy thead th.prog,.rdy tbody td.prog{width:132px}
.rdy .score{display:flex;flex-direction:column;align-items:center;gap:7px;justify-content:center}
.rdy .track{width:74px;height:6px;border-radius:99px;background:rgba(255,255,255,.13);overflow:hidden}
.rdy .track i{display:block;height:100%;background:#30D158}
.rdy .snum{font-size:11.5px;color:var(--mut);font-variant-numeric:tabular-nums;letter-spacing:.02em}
/* the anchor fills the whole cell so hover covers the full column width */
.rdy a.cell{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;width:100%;
  padding:0 10px;text-decoration:none;border-radius:5px;transition:background .12s}
.rdy a.cell:hover{background:rgba(255,255,255,.10)}
.rdy a.cell:focus-visible{outline:2px solid #4C9AFF;outline-offset:-2px}
.rdy .st{width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 26px}
.rdy .st svg{width:21px;height:21px;display:block}
.rdy .drv{width:32px;height:32px;object-fit:contain;display:block}
.rdy thead th.drivec,.rdy tbody td.drivec,.rdy thead th.fioc,.rdy tbody td.fioc{width:96px}
.rdy .fio{width:26px;height:26px;object-fit:contain;display:block;transition:opacity .12s}
.rdy a.cell:hover .fio{opacity:.78}
.rdy .lk{width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 26px}
.rdy .lk svg{width:20px;height:20px;display:block;transition:opacity .12s}
.rdy .st svg,.rdy .lk svg,.rdy .drv{transition:filter .12s,opacity .12s}
.rdy a.cell:hover .st svg,.rdy a.cell:hover .lk svg{filter:brightness(1.35) saturate(1.15)}
.rdy a.cell:hover .drv{filter:brightness(1.15)}
.rdy a.cell:hover .drv.off{filter:grayscale(1) brightness(1);opacity:.85}
.rdy a.cell:hover .dsh{color:rgba(255,255,255,.55)}
.rdy a.cell:hover .frac{color:rgba(255,255,255,.78)}
.rdy a.cell:hover .idn{color:rgba(255,255,255,.85)}
.rdy a.cell:hover .bname{color:#fff}
.rdy .dsh{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;
  color:rgba(255,255,255,.22);font-size:16px;line-height:1}
.rdy .drv.off{filter:grayscale(1) brightness(.62);opacity:.5}
.rdy .frac{display:block;font-size:11.5px;color:var(--mut);margin-top:5px;line-height:1}
.rdy .key{display:flex;gap:26px;flex-wrap:wrap;margin-top:16px;font-size:13px;color:var(--mut);align-items:center}
.rdy .key span{display:flex;align-items:center;gap:7px}
.rdy .key .st,.rdy .key .lk,.rdy .key .dsh{width:22px;height:22px;flex:0 0 22px}
.rdy .key .st svg,.rdy .key .lk svg{width:18px;height:18px}

/* ── mobile cards (campaign-cards-v9) ───────────────────────── */
.rdy .only-narrow{display:none}
.rdy .camp{background:#191B21;border:1px solid rgba(255,255,255,.08);border-radius:20px;margin-bottom:11px;overflow:hidden}
.rdy .ch{width:100%;display:flex;align-items:center;gap:12px;padding:14px;background:none;border:none;
  color:inherit;font:inherit;cursor:pointer;text-align:left}
.rdy .lg{width:38px;height:38px;flex:0 0 38px;border-radius:11px;background:rgba(255,255,255,.95);
  display:flex;align-items:center;justify-content:center;padding:6px}
.rdy .lg img{max-width:100%;max-height:100%;object-fit:contain}
.rdy .ct{min-width:0;flex:1}
.rdy .cn{display:block;font-size:15px;font-weight:600;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rdy .cm{display:block;font-size:11.5px;color:rgba(255,255,255,.5);margin-top:2px}
.rdy .cc{text-align:right}
.rdy .cc b{font-size:18px;font-weight:600;line-height:1;font-variant-numeric:tabular-nums}
.rdy .cc span{display:block;font-size:10px;color:rgba(255,255,255,.42);margin-top:2px}
.rdy .cv{width:18px;height:18px;color:rgba(255,255,255,.35);transition:transform .22s;flex:0 0 18px}
.rdy .cv svg{width:100%;height:100%;display:block}
.rdy .camp.open>.ch .cv{transform:rotate(180deg)}
.rdy .deck{display:none;padding:2px 0 0}
.rdy .camp.open .deck{display:block}
.rdy .sect{border-radius:20px 20px 0 0;margin-top:-16px;position:relative;overflow:hidden;
  box-shadow:0 -10px 22px rgba(0,0,0,.55)}
.rdy .sect:first-child{margin-top:0}
.rdy .sect:nth-child(1){z-index:1}.rdy .sect:nth-child(2){z-index:2}.rdy .sect:nth-child(3){z-index:3}
.rdy .sect.open{z-index:9;margin-top:-4px}
/* .sh is a <button>: font:inherit does NOT carry colour, so set it explicitly
   or the title renders near-black on the black card. */
.rdy .sh{width:100%;display:flex;align-items:center;gap:11px;padding:20px 16px 26px;background:none;
  border:none;font:inherit;color:inherit;cursor:pointer;text-align:left}
.rdy .si{width:26px;height:26px;flex:0 0 26px;display:flex;align-items:center;justify-content:center}
.rdy .si img{max-width:100%;max-height:100%;object-fit:contain;display:block}
.rdy .st2{font-size:16px;font-weight:700;letter-spacing:.005em;color:inherit}
.rdy .sc{font-size:12px;opacity:.6;font-variant-numeric:tabular-nums;margin-left:2px}
.rdy .sh .cv{margin-left:auto;width:30px;height:30px;flex:0 0 30px;border-radius:50%;
  display:flex;align-items:center;justify-content:center}
.rdy .sh .cv svg{width:18px;height:18px}
.rdy .w .sh .cv{background:rgba(0,0,0,.07)}
.rdy .g .sh .cv,.rdy .o .sh .cv{background:rgba(255,255,255,.12)}
.rdy .sect.open .sh .cv{transform:rotate(180deg)}
.rdy .sb{display:none;flex-direction:column;gap:7px;padding:0 12px 16px}
.rdy .sect.open .sb{display:flex}
.rdy .sect.open .sh{padding-bottom:16px}
.rdy .w{background:linear-gradient(168deg,#FFFFFF,#E9E9EE);color:#16181D}
.rdy .w .cv{color:rgba(0,0,0,.5)}
.rdy .g{background:#0B0B0E;color:#fff;box-shadow:0 6px 18px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.07) inset}
.rdy .g .cv{color:rgba(255,255,255,.6)}
.rdy .o{background:linear-gradient(168deg,#E4571A,#B8360A);color:#fff}
.rdy .o .cv{color:rgba(255,255,255,.8)}
.rdy .it{display:flex;align-items:center;gap:11px;height:58px;padding:0 9px 0 11px;border-radius:14px}
.rdy .w .it{background:rgba(0,0,0,.055)}.rdy .w .it.off{background:rgba(0,0,0,.03)}
.rdy .g .it{background:rgba(255,255,255,.075)}.rdy .g .it.off{background:rgba(255,255,255,.035)}
.rdy .o .it{background:rgba(0,0,0,.16)}.rdy .o .it.off{background:rgba(0,0,0,.09)}
.rdy .s{width:20px;height:20px;flex:0 0 20px}
.rdy .s svg{width:100%;height:100%;display:block}
.rdy .s .st{width:20px;height:20px;flex:0 0 20px}
.rdy .s .st svg{width:20px;height:20px}
/* the badge inverts per card — Frame.io's mark and adidas's 3-bar are white
   and would vanish on the white Assets card */
.rdy .bg{width:36px;height:36px;flex:0 0 36px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;padding:7px}
.rdy .w .bg{background:#16181D}
.rdy .g .bg,.rdy .o .bg{background:rgba(255,255,255,.94)}
.rdy .bg img{max-width:100%;max-height:100%;object-fit:contain}
.rdy .it.off .bg img{opacity:.42;filter:grayscale(1)}
.rdy .nm{font-size:14.5px;font-weight:600;min-width:0}
.rdy .nm i{display:block;font-style:normal;font-size:11px;font-weight:400;opacity:.6;margin-top:1px}
.rdy .it.off .nm{opacity:.55;font-weight:500}
/* always an orange glyph on a disc: white when it exists, grey when it doesn't.
   Two greys — one mid-grey either vanishes on white or smudges on black. */
.rdy .go{margin-left:auto;width:36px;height:36px;flex:0 0 36px;border-radius:50%;display:flex;
  align-items:center;justify-content:center;text-decoration:none;
  background:#FFFFFF;color:var(--org);box-shadow:0 2px 5px rgba(0,0,0,.28)}
.rdy .it.off .go{background:#8E9099;color:var(--org);box-shadow:0 1px 3px rgba(0,0,0,.25)}
.rdy .w .it.off .go{background:#C3C5CB}
.rdy .go svg{width:17px;height:17px}
.rdy .go:active{background:var(--org);color:#FFFFFF}

@media(max-width:750px){
  .rdy{padding:18px 12px 60px}
  .rdy h1{font-size:18px}
  .rdy .wrap{max-width:420px}
  .rdy .only-wide{display:none}
  .rdy .only-narrow{display:block}
  .rdy .strip{display:none}
  .rdy .key{display:none}
  .rdy .shown{margin-left:0}
}
`;
