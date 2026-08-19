// src/app/w9/W9Form.tsx
// ─────────────────────────────────────────────────────────────
// The client half of /w9 — the form itself.
//
// The visual components below (Card, Field, Check, Footer and the `sf-*`
// styles) are DUPLICATED from src/app/submit/[token]/page.tsx rather than
// imported. They are local to that file, and exporting them would mean editing
// a page that is out of scope for this change and carries the live athlete
// upload flow. Duplication is the deliberate call: a copied 200 lines of CSS is
// cheaper than a regression in the pipeline that collects campaign content.
//
// States: FORM → SENDING → DONE, plus the record-failure branch.
//
// The one behaviour worth knowing: if the PDF reaches Drive but the database
// insert fails, the route hands back the Drive pointer and this form retries
// THE RECORD ONLY. Re-posting the file would leave two copies of someone's tax
// document in the folder for a human to reconcile. Same shape as the submit
// page's `recordFailed` state.
// ─────────────────────────────────────────────────────────────

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const MONO = "var(--font-mono), ui-monospace, monospace";

/** Matches MAX_FILE_BYTES in /api/w9. Vercel's body cap is ~4.5MB and this
 *  file is relayed through our own function, so 4MB is the honest number. */
const MAX_FILE_BYTES = 4 * 1024 * 1024;

const IRS_W9_URL = "https://www.irs.gov/pub/irs-pdf/fw9.pdf";

type Phase = "form" | "sending" | "done";

interface Done {
  payee: string;
  fileName: string;
  fileSizeBytes: number | null;
  receivedAt: string;
  taxYear: number;
}

/** The Drive pointer handed back when the upload landed but the insert didn't,
 *  so the retry can skip straight to the record. */
interface Orphan {
  driveFileId: string;
  fileName: string;
  fileSizeBytes: number | null;
}

const FIELDS = [
  "business_name",
  "first_name",
  "last_name",
  "email",
  "phone",
  "address_line1",
  "address_line2",
  "city",
  "state",
  "postal_code",
] as const;

type FieldName = (typeof FIELDS)[number];

/** Everything except the two genuinely optional ones. Business name never
 *  blocks the send — most videographers file personally. */
const REQUIRED: FieldName[] = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "address_line1",
  "city",
  "state",
  "postal_code",
];

type Values = Record<FieldName, string>;

const EMPTY: Values = FIELDS.reduce((acc, k) => ({ ...acc, [k]: "" }), {} as Values);

function humanSize(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Mirrors derivedFileName() in /api/w9 so the `SAVES TO DRIVE AS` preview shows
 * the submitter the real destination name. The server's copy is the one that
 * decides — this is a preview, and it does not know about collision suffixes.
 */
function previewFileName(business: string, first: string, last: string): string {
  const base = business.trim() || `${first} ${last}`;
  const name = base
    .trim()
    .toUpperCase()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${name || "UNNAMED"} W9.pdf`;
}

function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

export default function W9Form({
  logoPrimaryUrl,
  logoDarkUrl,
}: {
  logoPrimaryUrl: string | null;
  logoDarkUrl: string | null;
}) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [acked, setAcked] = useState(false);
  const [ackAt, setAckAt] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [orphan, setOrphan] = useState<Orphan | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const set = (k: FieldName) => (v: string) => setValues((p) => ({ ...p, [k]: v }));

  // Don't let a submission in flight be closed out from under the videographer.
  useEffect(() => {
    if (phase !== "sending") return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [phase]);

  const saveAs = useMemo(
    () => previewFileName(values.business_name, values.first_name, values.last_name),
    [values.business_name, values.first_name, values.last_name]
  );

  const filled = REQUIRED.every((k) => values[k].trim().length > 0);
  // The gate. Business name is deliberately absent — it never blocks.
  const ready = filled && !!file && acked && phase === "form";

  function pick(f: File | null) {
    setError(null);
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      setError("That file is over 4MB. Try saving the PDF at a smaller size.");
      return;
    }
    // The server checks the bytes; this is the fast, friendly version.
    if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) {
      setError("Your W-9 needs to be a PDF.");
      return;
    }
    setFile(f);
  }

  function toggleAck(on: boolean) {
    setAcked(on);
    // Stamped at tick time, same as the submit form. The server accepts it only
    // if it's within a day of server time, so a wrong phone clock can't lose
    // the submission — it just gets restamped.
    setAckAt(on ? new Date().toISOString() : null);
  }

  function send() {
    if (!ready && !orphan) return;
    setError(null);
    setPhase("sending");
    setProgress(0);

    const body = new FormData();
    for (const k of FIELDS) body.append(k, values[k]);
    body.append("ack_accurate_at", ackAt ?? new Date().toISOString());
    if (orphan) {
      // Retry after a failed insert: send the pointer, NOT the file again.
      body.append("drive_file_id", orphan.driveFileId);
    } else if (file) {
      body.append("file", file);
    }

    // XHR rather than fetch(): fetch gives no upload progress, and the send
    // button IS the progress bar in this design.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/w9");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let payload: any = {};
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        /* falls through to the generic message below */
      }
      if (xhr.status >= 200 && xhr.status < 300 && payload.ok) {
        setDone({
          payee: values.business_name.trim() || `${values.first_name} ${values.last_name}`.trim(),
          fileName: payload.fileName ?? saveAs,
          fileSizeBytes: payload.fileSizeBytes ?? file?.size ?? null,
          receivedAt: payload.receivedAt ?? new Date().toISOString(),
          taxYear: new Date().getFullYear(),
        });
        setPhase("done");
        return;
      }
      if (payload.recordFailed && payload.driveFileId) {
        setOrphan({
          driveFileId: payload.driveFileId,
          fileName: payload.fileName ?? saveAs,
          fileSizeBytes: payload.fileSizeBytes ?? null,
        });
      }
      setError(payload.error ?? "Something went wrong. Please try again.");
      setPhase("form");
    };
    xhr.onerror = () => {
      setError("We couldn't reach Postgame. Check your connection and try again.");
      setPhase("form");
    };
    xhr.send(body);
  }

  // ── DONE ────────────────────────────────────────────────────
  if (phase === "done" && done) {
    return (
      <>
        <Styles />
        <div className="sf sf-light">
          {/* The header bar stays black even on the light screen, so the mark
              there is still the white-lettering variant. */}
          <Header logo={logoPrimaryUrl} />
          <div className="sf-page">
            <div className="sf-fin">
              <span className="sf-fin-ring">
                <TickIcon />
              </span>
              <h1 className="d sf-fin-h">W-9 received</h1>
              <div className="sf-fin-sub">We’ve got your W-9 on file for {done.taxYear}.</div>
              <div className="sf-fin-chips">
                {done.payee && <span className="sf-chip">{done.payee}</span>}
                <span className="sf-chip">
                  1 PDF{done.fileSizeBytes ? ` · ${humanSize(done.fileSizeBytes)}` : ""}
                </span>
              </div>
              <div className="sf-fin-meta">{formatStamp(done.receivedAt)}</div>
              <div className="sf-fin-note">
                Nothing else to do. If anything on the form is missing or unsigned we’ll come back
                to you before your next payment goes out.
              </div>
            </div>
            {/* Black-ink mark: the primary mark is white lettering and would
                vanish against #FAF8F5. */}
            <Footer logo={logoDarkUrl} />
          </div>
        </div>
      </>
    );
  }

  // ── FORM / SENDING ──────────────────────────────────────────
  const busy = phase === "sending";
  const sendLabel = busy
    ? `Sending · ${progress}%`
    : orphan
      ? "Retry sending my details"
      : "Send my W-9";
  const sendClass = busy ? "sf-send busy" : ready || orphan ? "sf-send" : "sf-send off";

  return (
    <>
      <Styles />
      <div className="sf">
        <Header logo={logoPrimaryUrl} />
        <div className="sf-page">
          <div className="sf-top">
            <h1 className="d sf-h1">Send us your W-9</h1>
            <div className="sf-sub">We need a signed W-9 on file before we can pay you.</div>
            <div className="sf-sub sf-deliv">Takes about two minutes.</div>
          </div>

          <Card title="Who we’re paying">
            <Field
              label="Business name"
              optional
              placeholder="Business Name LLC"
              value={values.business_name}
              onChange={set("business_name")}
              disabled={busy}
              className="sf-fg"
            />
            <div className="sf-two sf-fg">
              <Field
                label="First name"
                placeholder="Jordan"
                value={values.first_name}
                onChange={set("first_name")}
                disabled={busy}
                autoComplete="given-name"
              />
              <Field
                label="Last name"
                placeholder="Blake"
                value={values.last_name}
                onChange={set("last_name")}
                disabled={busy}
                autoComplete="family-name"
              />
            </div>
            <Field
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={values.email}
              onChange={set("email")}
              disabled={busy}
              autoComplete="email"
              className="sf-fg"
            />
            <Field
              label="Phone"
              type="tel"
              placeholder="(941) 555-0143"
              value={values.phone}
              onChange={set("phone")}
              disabled={busy}
              autoComplete="tel"
            />
          </Card>

          <Card title="Where we send tax documents">
            <Field
              label="Street address"
              placeholder="1200 Main Street"
              value={values.address_line1}
              onChange={set("address_line1")}
              disabled={busy}
              autoComplete="address-line1"
              className="sf-fg"
            />
            <Field
              label="Apt / suite"
              optional
              placeholder="Suite 300"
              value={values.address_line2}
              onChange={set("address_line2")}
              disabled={busy}
              autoComplete="address-line2"
              className="sf-fg"
            />
            <div className="sf-city">
              <Field
                label="City"
                placeholder="Sarasota"
                value={values.city}
                onChange={set("city")}
                disabled={busy}
                autoComplete="address-level2"
              />
              <Field
                label="State"
                placeholder="FL"
                value={values.state}
                onChange={(v) => set("state")(v.toUpperCase().slice(0, 2))}
                disabled={busy}
                autoComplete="address-level1"
                maxLength={2}
              />
              <Field
                label="ZIP"
                placeholder="34236"
                value={values.postal_code}
                onChange={set("postal_code")}
                disabled={busy}
                autoComplete="postal-code"
                inputMode="numeric"
              />
            </div>
            <div className="sf-hint">
              This is where your 1099 goes in January. Use the address on your tax return.
            </div>
          </Card>

          <Card title="Your W-9">
            <div className="sf-zones">
              <div className="sf-zn pri">
                <div className="sf-zh">
                  <span className="sf-zic">
                    <DocIcon />
                  </span>
                  <span className="sf-ztl">
                    <span className="a">Your signed W-9</span>
                    <span className="b">One PDF · 4MB max</span>
                  </span>
                  <span className={`sf-zst${file ? " ok" : ""}`}>{file ? "1 file" : "none yet"}</span>
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/pdf,.pdf"
                  hidden
                  onChange={(e) => pick(e.target.files?.[0] ?? null)}
                />
                {/* While there's no file this is the only thing on screen worth
                    tapping, so it takes the orange. Once a file lands it steps
                    back to glass and the send button takes over — one orange
                    destination at a time. */}
                <button
                  type="button"
                  className={`sf-zbtn${file ? "" : " pri"}`}
                  disabled={busy}
                  onClick={() => fileInput.current?.click()}
                >
                  <UploadIcon />
                  {file ? "Choose a different file" : "Choose your W-9"}
                </button>
              </div>
              <div className="sf-zn">
                <div className="sf-get-q">Don’t have one yet?</div>
                <a className="sf-get-a" href={IRS_W9_URL} target="_blank" rel="noopener noreferrer">
                  <DownloadIcon />
                  Download the blank IRS Form W-9
                </a>
                <div className="sf-get-n">Fill it in, sign it, and save it as a PDF.</div>
              </div>
            </div>

            {file && (
              <>
                <div className="sf-row">
                  <div className="sf-row-th">
                    <DocIcon />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="sf-row-n">{file.name}</div>
                    {busy && (
                      <div className="sf-bar">
                        <i style={{ width: `${progress}%` }} />
                      </div>
                    )}
                    <div className="sf-row-m">
                      {busy
                        ? `${progress}% · ${humanSize(file.size)}`
                        : `${humanSize(file.size)} · PDF`}
                    </div>
                  </div>
                  {!busy && (
                    <button
                      type="button"
                      className="sf-rm"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => {
                        setFile(null);
                        if (fileInput.current) fileInput.current.value = "";
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="sf-saveas">
                  <div className="k">Saves to Drive as</div>
                  <div className="v">{orphan?.fileName ?? saveAs}</div>
                </div>
              </>
            )}
          </Card>

          <Card title="Before you send">
            <Check checked={acked} disabled={busy} onToggle={toggleAck}>
              I’ve verified that all the information on my W-9 is accurate and up to date. The form
              is signed and dated.
            </Check>

            {error && <div className="sf-err">{error}</div>}

            <button
              type="button"
              className={sendClass}
              disabled={busy || (!ready && !orphan)}
              onClick={send}
            >
              {/* The button IS the progress bar: an orange fill riding over a
                  dim track. It must never go flat grey mid-send — grey reads as
                  "finished" and people close the tab. */}
              {busy && <span className="sf-send-fill" style={{ width: `${progress}%` }} />}
              <span className="sf-send-lb">
                {busy && <span className="sf-spin" aria-hidden="true" />}
                {sendLabel}
              </span>
            </button>
            {busy && <div className="sf-send-help">Keep this page open until it finishes.</div>}
          </Card>

          <Footer logo={logoPrimaryUrl} />
        </div>
      </div>
    </>
  );
}

// ── Pieces ────────────────────────────────────────────────────

function Header({ logo }: { logo: string | null }) {
  return (
    <>
      <header className="sf-hdr">
        <div className="sf-hdr-in">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Postgame" />
          ) : (
            <span className="d sf-hdr-tx">POSTGAME</span>
          )}
        </div>
      </header>
      <div className="sf-rule" />
    </>
  );
}

function Footer({ logo }: { logo: string | null }) {
  return (
    <div className="sf-foot">
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="Postgame" />
      )}
      <div className="q">Have a question?</div>
      <div className="sf-ln">
        <span className="sf-ln-i">
          <MsgIcon /> Text your Postgame contact
        </span>
        <a href="https://instagram.com/postgame" target="_blank" rel="noopener noreferrer">
          <IgIcon /> DM @postgame
        </a>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sf-card">
      <div className="sf-ct">{title}</div>
      <div className="sf-cb">{children}</div>
    </div>
  );
}

function Field({
  label,
  optional,
  placeholder,
  value,
  onChange,
  disabled,
  className,
  type = "text",
  autoComplete,
  inputMode,
  maxLength,
}: {
  label: string;
  optional?: boolean;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "text" | "tel" | "email";
  maxLength?: number;
}) {
  return (
    <div className={className}>
      <label className="sf-fl">
        {label}
        {optional && <i> optional</i>}
      </label>
      <input
        className="sf-fi"
        type={type}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// A div rather than a <button>/<label>: role="checkbox" + tabIndex + Space/Enter
// gives the same semantics without nesting restrictions, matching the pattern
// the submit form uses.
function Check({
  checked,
  disabled,
  onToggle,
  children,
}: {
  checked: boolean;
  disabled: boolean;
  onToggle: (on: boolean) => void;
  children: React.ReactNode;
}) {
  const toggle = () => {
    if (!disabled) onToggle(!checked);
  };
  return (
    <div
      className="sf-ack"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <span className={`sf-box${checked ? " on" : ""}`}>{checked && <TickIcon />}</span>
      <div className="sf-ack-tx">{children}</div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const DocIcon = () => (
  <svg viewBox="0 0 24 24" {...S} strokeWidth={1.8}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" {...S} strokeWidth={1.8}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M17 8l-5-5-5 5M12 3v13" />
  </svg>
);

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" {...S} strokeWidth={1.8}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5M12 15V3" />
  </svg>
);

const TickIcon = () => (
  <svg viewBox="0 0 24 24" {...S} strokeWidth={3}>
    <path d="m20 6-11 11-5-5" />
  </svg>
);

const MsgIcon = () => (
  <svg viewBox="0 0 24 24" {...S} strokeWidth={1.8}>
    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.1A8.4 8.4 0 0 1 4 11.5a8.4 8.4 0 0 1 8.5-8.4h.5a8.4 8.4 0 0 1 8 8z" />
  </svg>
);

const IgIcon = () => (
  <svg viewBox="0 0 24 24" {...S} strokeWidth={1.8}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
  </svg>
);

// ── Styles ────────────────────────────────────────────────────
// dangerouslySetInnerHTML rather than a text child: browsers parse <style>
// content as RAW TEXT and never decode entities, so React escaping a `>` in a
// selector would silently break the rule. Not a style choice — the submit page
// carries the same note.

function Styles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
  .sf { min-height:100vh; background:#07070A; color:rgba(250,248,245,0.82);
        font:15px/1.6 Arial, Helvetica, sans-serif; -webkit-font-smoothing:antialiased; }
  .sf *, .sf *::before, .sf *::after { box-sizing:border-box; }
  .sf img { display:block; }
  /* No background:none in this reset. ".sf button" is (0,1,1) and would beat
     ".sf-send" / ".sf-zbtn" at (0,1,0), stripping the orange off the send
     button and the glass off the file button — the approved mockup has exactly
     that collision. The one genuinely bare button sets its own background. */
  .sf button { font-family:Arial, Helvetica, sans-serif; cursor:pointer; border:none;
               color:inherit; }
  .sf .d { font-family:var(--font-bebas), 'Bebas Neue', Impact, sans-serif; font-weight:400; }

  .sf-hdr { background:rgba(7,7,10,.92); backdrop-filter:blur(18px); position:sticky; top:0;
            z-index:10; border-bottom:1px solid rgba(250,248,245,0.14); }
  .sf-hdr-in { max-width:560px; margin:0 auto; padding:15px 20px; display:flex;
               align-items:center; justify-content:center; position:relative; }
  .sf-hdr img { height:24px; width:auto; }
  .sf-hdr-tx { color:#FAF8F5; font-size:21px; letter-spacing:.06em; }
  .sf-rule { height:4px; background:#D73F09; }

  .sf-page { max-width:560px; margin:0 auto; padding:0 20px 60px; }

  .sf-top { padding:26px 0 20px; text-align:center; }
  .sf-h1 { font-size:32px; color:rgba(250,248,245,1); letter-spacing:.02em; line-height:1.02;
           margin:0 0 10px; }
  .sf-sub { font-size:14px; color:rgba(250,248,245,0.82); line-height:1.6; }
  .sf-deliv { color:rgba(250,248,245,0.62); margin-top:6px; }

  .sf-card { background:rgba(250,248,245,0.07); border:1px solid rgba(250,248,245,0.14);
             border-radius:13px; overflow:hidden; margin-bottom:12px; }
  .sf-ct { background:#D73F09; color:#fff; padding:9px 15px; font-family:${MONO};
           font-size:9.5px; letter-spacing:.16em; text-transform:uppercase; }
  .sf-cb { padding:15px; }

  .sf-fl { display:block; font-family:${MONO}; font-size:9px;
           letter-spacing:.12em; text-transform:uppercase; color:rgba(250,248,245,0.62);
           margin-bottom:5px; }
  .sf-fl i { font-style:normal; color:rgba(250,248,245,0.35); }
  /* 16px on mobile is not a taste call — anything smaller makes iOS Safari zoom
     the viewport on focus and the layout never comes back. */
  .sf-fi { width:100%; border:1px solid rgba(250,248,245,0.14); border-radius:9px;
           padding:12px 13px; font-size:16px; color:rgba(250,248,245,1);
           font-family:Arial, Helvetica, sans-serif; background:rgba(0,0,0,.32); appearance:none; }
  .sf-fi::placeholder { color:rgba(250,248,245,0.45); }
  .sf-fi:disabled { opacity:.6; }
  .sf-two { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .sf-city { display:grid; grid-template-columns:1fr 76px 96px; gap:10px; }
  .sf-fg { margin-bottom:12px; }
  .sf-hint { font-size:12px; color:rgba(250,248,245,0.45); margin-top:6px; line-height:1.5; }

  .sf-zones { border:1px solid rgba(250,248,245,0.14); border-radius:12px; overflow:hidden;
              background:rgba(0,0,0,.22); }
  .sf-zn { padding:16px; }
  .sf-zn + .sf-zn { border-top:1px solid rgba(250,248,245,0.14); }
  .sf-get-q { font-size:12.5px; color:rgba(250,248,245,0.62); line-height:1.5; }
  /* nowrap keeps the IRS link on its own line instead of breaking mid-phrase
     at 320px, where it otherwise wraps to "…Form" / "W-9". */
  .sf-get-a { display:inline-flex; gap:7px; align-items:center; margin-top:9px; font-size:13px;
              color:#D73F09; text-decoration:none; white-space:nowrap; }
  .sf-get-a:hover { text-decoration:underline; }
  .sf-get-a svg { width:14px; height:14px; flex:0 0 auto; }
  .sf-get-n { font-size:11.5px; color:rgba(250,248,245,0.45); margin-top:9px; line-height:1.5; }
  .sf-zn.pri { background:rgba(215,63,9,.07); }
  .sf-zh { display:flex; gap:11px; align-items:flex-start; margin-bottom:12px; }
  .sf-zic { width:34px; height:34px; border-radius:10px; display:flex; align-items:center;
            justify-content:center; flex:0 0 auto; background:#D73F09; color:#fff; }
  .sf-zic svg { width:17px; height:17px; }
  .sf-ztl { flex:1; min-width:0; }
  .sf-ztl .a { display:block; font-size:15.5px; color:rgba(250,248,245,1); line-height:1.25; }
  .sf-ztl .b { display:block; font-size:12.5px; color:rgba(250,248,245,0.62); margin-top:2px; }
  .sf-zst { font-family:${MONO}; font-size:11px; color:rgba(250,248,245,0.45);
            white-space:nowrap; padding:4px 9px; border-radius:20px; background:rgba(250,248,245,0.1); }
  .sf-zst.ok { background:rgba(126,226,168,.14); color:#7ee2a8; }
  .sf-zbtn { width:100%; min-height:54px; border:1px solid rgba(250,248,245,0.14); border-radius:10px;
             padding:14px; font-size:15.5px; color:rgba(250,248,245,1); background:rgba(0,0,0,.28);
             display:flex; gap:9px; align-items:center; justify-content:center; }
  .sf-zbtn.pri { background:#D73F09; border-color:#D73F09; color:#fff; font-weight:bold;
                 font-size:16px; }
  /* Touch devices have no hover, so the press feedback is the only signal the
     tap registered. Required, not decorative. */
  .sf-zbtn.pri:active { filter:brightness(.9); }
  .sf-zbtn:not(.pri):active { background:rgba(0,0,0,.45); }
  .sf-zbtn:disabled { opacity:.6; cursor:not-allowed; }
  .sf-zbtn svg { width:17px; height:17px; }

  .sf-row { display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:12px;
            border:1px solid rgba(250,248,245,0.14); background:rgba(0,0,0,.22); margin-top:14px; }
  .sf-row-th { width:40px; height:40px; border-radius:9px; flex:0 0 auto; background:rgba(250,248,245,0.1);
               display:flex; align-items:center; justify-content:center; color:rgba(250,248,245,0.55); }
  .sf-row-th svg { width:18px; height:18px; }
  .sf-row-n { font-size:14px; color:rgba(250,248,245,1); white-space:nowrap; overflow:hidden;
              text-overflow:ellipsis; }
  .sf-row-m { font-size:12px; color:rgba(250,248,245,0.62); margin-top:3px; }
  .sf-bar { height:4px; border-radius:999px; background:rgba(250,248,245,0.1); margin:6px 0;
            overflow:hidden; }
  .sf-bar > i { display:block; height:100%; background:#D73F09; transition:width .2s; }
  .sf-rm { background:none; color:rgba(250,248,245,0.45); font-size:15px; flex:0 0 auto; }

  .sf-saveas { margin-top:12px; padding:10px 12px; border-radius:10px; background:rgba(0,0,0,.28);
               border:1px solid rgba(250,248,245,0.10); }
  .sf-saveas .k { font-family:${MONO}; font-size:9px; letter-spacing:.12em;
                  text-transform:uppercase; color:rgba(250,248,245,0.45); }
  .sf-saveas .v { font-family:${MONO}; font-size:12px;
                  color:rgba(250,248,245,0.82); margin-top:4px; word-break:break-all; }

  .sf-ack { display:flex; gap:11px; align-items:flex-start; padding:12px 0;
            border-top:1px solid rgba(250,248,245,0.08); cursor:pointer; }
  .sf-cb > .sf-ack:first-child { border-top:none; padding-top:0; }
  .sf-ack:focus-visible { outline:2px solid #D73F09; outline-offset:3px; border-radius:6px; }
  .sf-box { width:21px; height:21px; border-radius:6px; border:1.5px solid rgba(250,248,245,0.22);
            flex:0 0 auto; margin-top:1px; display:flex; align-items:center; justify-content:center; }
  .sf-box.on { background:#D73F09; border-color:#D73F09; color:#fff; }
  .sf-box svg { width:12px; height:12px; }
  .sf-ack-tx { font-size:13px; line-height:1.55; color:rgba(250,248,245,0.82); min-width:0; }

  .sf-err { margin-top:12px; padding:10px 12px; border-radius:9px; font-size:13px; line-height:1.5;
            background:rgba(215,63,9,.12); border:1px solid rgba(215,63,9,.4); color:#F0A88A; }

  .sf-send { position:relative; overflow:hidden; width:100%; background:#D73F09; color:#fff;
             border-radius:11px; padding:15px; font-size:16px; font-weight:bold; margin-top:16px; }
  .sf-send.off { background:rgba(250,248,245,0.08); color:rgba(250,248,245,0.45); cursor:not-allowed; }
  /* .busy keeps a DIM TRACK, never a flat grey button — the orange fill rides
     over it. A grey button mid-send reads as "finished". */
  .sf-send.busy { background:rgba(250,248,245,0.12); color:#fff; cursor:progress; }
  .sf-send-fill { position:absolute; left:0; top:0; bottom:0; background:#D73F09; transition:width .2s; }
  .sf-send-lb { position:relative; display:inline-flex; align-items:center; justify-content:center;
                gap:9px; }
  .sf-send-help { margin-top:10px; text-align:center; font-size:12.5px; color:rgba(250,248,245,0.55); }
  .sf-spin { width:14px; height:14px; border-radius:999px; flex:0 0 auto;
             border:2px solid rgba(255,255,255,.35); border-top-color:#fff;
             animation:sf-spin .7s linear infinite; }
  @keyframes sf-spin { to { transform:rotate(360deg); } }

  .sf-light { background:#FAF8F5; color:rgba(18,18,26,0.82); }
  .sf-light .sf-foot { border-top-color:rgba(18,18,26,0.10); }
  .sf-light .sf-foot img { opacity:.8; }
  .sf-light .sf-foot .q { color:rgba(18,18,26,0.72); }
  /* Scoped through .sf-ln so it outranks the dark ".sf-ln .sf-ln-i" rule below
     regardless of source order — cream on #FAF8F5 is invisible. */
  .sf-light .sf-ln .sf-ln-i { color:rgba(18,18,26,0.72); }
  .sf-fin { text-align:center; padding:56px 0 8px; }
  .sf-fin-ring { width:76px; height:76px; border-radius:999px; border:2px solid rgba(31,163,92,.3);
                 color:#1FA35C; margin:0 auto 22px; display:flex; align-items:center;
                 justify-content:center; }
  .sf-fin-ring svg { width:30px; height:30px; }
  .sf-fin-h { font-size:44px; line-height:1.02; letter-spacing:.02em; margin:0 0 10px; color:#12121A; }
  .sf-fin-sub { font-size:15px; line-height:1.6; color:rgba(18,18,26,0.68); }
  .sf-fin-chips { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-top:20px; }
  .sf-chip { background:#fff; border:1px solid rgba(18,18,26,0.12); border-radius:999px;
             padding:7px 13px; font-family:${MONO}; font-size:11px;
             letter-spacing:.08em; text-transform:uppercase; color:rgba(18,18,26,0.72); }
  .sf-fin-meta { margin-top:18px; font-family:${MONO}; font-size:11px;
                 letter-spacing:.12em; text-transform:uppercase; color:rgba(18,18,26,0.45); }
  .sf-fin-note { max-width:420px; margin:28px auto 0; padding-top:22px;
                 border-top:1px solid rgba(18,18,26,0.10); font-size:14px; line-height:1.65;
                 color:rgba(18,18,26,0.68); }

  .sf-foot { text-align:center; padding:28px 0 0; border-top:1px solid rgba(250,248,245,0.08);
             margin-top:24px; }
  .sf-foot img { height:17px; width:auto; margin:0 auto 12px; opacity:.55; }
  .sf-foot .q { font-size:13px; color:rgba(250,248,245,0.82); }
  .sf-ln { display:flex; flex-direction:column; gap:9px; margin-top:11px; align-items:center; }
  .sf-ln a, .sf-ln .sf-ln-i { font-size:13px; color:#D73F09; text-decoration:none;
                              display:inline-flex; gap:6px; align-items:center; }
  .sf-ln .sf-ln-i { color:rgba(250,248,245,0.62); }
  .sf-ln svg { width:14px; height:14px; }

  @media (max-width:380px) {
    .sf-two { grid-template-columns:1fr; }
    .sf-city { grid-template-columns:1fr 1fr; }
    .sf-h1 { font-size:29px; }
    .sf-page { padding:0 16px 56px; }
    .sf-fin { padding:44px 0 8px; }
    .sf-fin-h { font-size:37px; }
  }
  @media (min-width:640px) {
    .sf-hdr-in { padding:18px 22px; }
    .sf-hdr img { height:28px; }
    .sf-page { padding:0 22px 70px; }
    .sf-top { padding:34px 0 26px; }
    .sf-h1 { font-size:42px; margin-bottom:13px; }
    .sf-sub { font-size:15px; }
    .sf-cb { padding:19px; }
    .sf-ct { padding:11px 19px; font-size:10px; }
    .sf-fi { font-size:15px; }
    .sf-ack-tx { font-size:14px; }
  }
`,
      }}
    />
  );
}
