"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Brief } from "@/lib/types";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface BrandKit {
  name: string;
  logo_primary_url: string | null;
  logo_light_url: string | null;
  logo_mark_url: string | null;
  primary_color: string | null;
}

const POSTGAME_LOGO = "https://xqaybwhpgxillpbbqtks.supabase.co/storage/v1/object/public/campaign-media/brand-kits/1774632055938-16gy1u2t.PNG";

function buildSystemPrompt(brief: Brief, brandKit: BrandKit | null): string {
  return `You are a Postgame brief generator. You produce complete, production-ready videographer brief HTML documents.

Brief context:
- Title: ${brief.title}
- Brand: ${brief.client_name}

${brandKit ? `Brand Kit:
- Brand Name: ${brandKit.name}
- Primary Logo URL: ${brandKit.logo_primary_url || "none"}
- Light Logo URL: ${brandKit.logo_light_url || "none"}` : ""}

Postgame Logo (always use): ${POSTGAME_LOGO}

RULES:
1. When generating or updating the brief, output ONLY the complete raw HTML — no explanation, no markdown fences, nothing else.
2. Always follow the Postgame orange theme: #D73F09 orange, black header gradient (#1A1A1A to #000), DM Sans font, all CSS in a style tag.
3. Always show both the Postgame logo and brand logo in the header using .logo-pill img tags.
4. For plain conversation, respond normally in text.
5. Make briefs detailed, cinematic, and production-ready.

CSS VARS: --orange:#D73F09; --orange-light:#F05A28; --bg:#F5F5F5; --text:#1A1A1A; --text-sec:#3D3D3D; --text-muted:#777; --border:#E2E2E2; --card-bg:#EFEFEF;
Header: black gradient. Orange stripe after header. Dark meta bar. Orange section numbers, dividers, shot time badges. Black dialogue boxes. Orange transition badges. Black footer.`;
}

const CHIPS = ["Generate the brief","Add shot list","Write athlete dialogue","Add cinematic notes","Add product section","Write checklist","Make it more detailed","Add IP-safe language"];

export default function BriefEditor() {
  const { id } = useParams<{ id: string }>();
  const supabase = createBrowserSupabase();
  const router = useRouter();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadBrief(); }, [id]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function loadBrief() {
    const { data } = await supabase.from("briefs").select("*").eq("id", id).single();
    if (data) {
      setBrief(data);
      if (data.html_content) setPreviewHtml(data.html_content);
      if (data.brand_id) {
        const { data: brand } = await supabase.from("brands").select("name, logo_primary_url, logo_light_url, logo_mark_url, primary_color").eq("id", data.brand_id).single();
        if (brand) setBrandKit(brand);
      }
      setMessages([{ role: "assistant", content: `Ready to build the **${data.title}** brief. Describe the campaign — shot list, athlete, product, setting, creative direction — and I will generate the full brief. Or just say "generate it".` }]);
    }
    setLoading(false);
  }

  async function saveBriefHtml(html: string) {
    if (!brief) return;
    setSaving(true);
    await supabase.from("briefs").update({ html_content: html, updated_at: new Date().toISOString() }).eq("id", brief.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const isHtml = (text: string) => text.trimStart().startsWith("<!DOCTYPE") || text.trimStart().startsWith("<html");

  async function sendMessage(userText?: string) {
    const text = userText ?? input.trim();
    if (!text || !brief) return;
    setInput("");
    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setThinking(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000,
          system: buildSystemPrompt(brief, brandKit),
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await response.json();
      const replyText = data.content?.[0]?.text || "";
      setMessages((prev) => [...prev, { role: "assistant", content: replyText }]);
      if (isHtml(replyText)) {
        setPreviewHtml(replyText);
        await saveBriefHtml(replyText);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Try again." }]);
    } finally {
      setThinking(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-screen bg-black text-white text-sm">Loading...</div>;
  if (!brief) return <div className="flex items-center justify-center h-screen bg-black text-white text-sm">Brief not found.</div>;

  return (
    <div className="flex h-screen bg-black overflow-hidden">
      <div className="w-[400px] flex-shrink-0 flex flex-col border-r border-gray-800">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700 text-gray-400 hover:text-white transition-colors flex-shrink-0">←</button>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#D73F09]">Brief Builder</div>
            <div className="text-sm font-semibold text-white mt-0.5 truncate max-w-[240px]">{brief.title}</div>
          </div>
          <div className="flex items-center gap-2">
            {saving && <span className="text-xs text-gray-500">Saving...</span>}
            {saved && <span className="text-xs text-green-500">Saved ✓</span>}
            <Link href={`/brief/${brief.slug}`} target="_blank" className="text-xs px-3 py-1.5 bg-[#D73F09] text-white font-bold rounded-lg hover:bg-[#B33407] transition-colors whitespace-nowrap">View Live →</Link>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user" ? "bg-[#D73F09] text-white rounded-br-sm" : "bg-[#1a1a1a] text-gray-200 rounded-bl-sm border border-gray-800"}`}>
                {isHtml(msg.content) ? (
                  <div className="text-[#D73F09] font-bold text-xs uppercase tracking-wider">✓ Brief generated &amp; saved</div>
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex justify-start">
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  {[0,150,300].map((d) => <span key={d} className="w-1.5 h-1.5 bg-[#D73F09] rounded-full animate-bounce" style={{animationDelay:`${d}ms`}} />)}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="px-4 py-2 border-t border-gray-800 flex flex-wrap gap-1.5">
          {CHIPS.map((chip) => (
            <button key={chip} onClick={() => sendMessage(chip)} disabled={thinking} className="text-xs px-2.5 py-1 border border-gray-700 rounded-full text-gray-400 hover:border-[#D73F09] hover:text-[#D73F09] transition-colors disabled:opacity-40">{chip}</button>
          ))}
        </div>
        <div className="p-4 border-t border-gray-800">
          <div className="flex gap-2">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }}} placeholder="Describe the campaign, shots, athlete..." rows={3} className="flex-1 px-3 py-2.5 bg-[#111] border border-gray-700 rounded-xl text-white text-sm focus:border-[#D73F09] outline-none resize-none placeholder-gray-600" />
            <button onClick={() => sendMessage()} disabled={thinking || !input.trim()} className="w-10 h-10 bg-[#D73F09] rounded-xl flex items-center justify-center flex-shrink-0 hover:bg-[#B33407] disabled:opacity-40 transition-colors self-end">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="white"><path d="M2 8L14 2L10 8L14 14L2 8Z"/></svg>
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col bg-[#0a0a0a] min-w-0">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Live Preview</span>
          {previewHtml && <span className="text-xs text-gray-600">{(previewHtml.length/1000).toFixed(0)}k chars</span>}
        </div>
        <div className="flex-1 overflow-auto p-4 flex justify-center">
          {previewHtml ? (
            <iframe srcDoc={previewHtml} className="w-full max-w-[860px] bg-white rounded-xl shadow-2xl" style={{height:"calc(100vh - 80px)"}} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-5xl mb-4 text-gray-800">✦</div>
              <div className="text-gray-500 text-sm">Start chatting to generate your brief</div>
              <div className="text-gray-700 text-xs mt-2">Preview appears here in real time</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
