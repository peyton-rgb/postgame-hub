"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/react";
import { useEffect, useRef, useState, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Custom FontSize extension                                         */
/*  TipTap doesn't ship a font-size extension, so we extend TextStyle */
/*  to support a `fontSize` attribute that maps to inline CSS.        */
/* ------------------------------------------------------------------ */
const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, "") || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

/* ------------------------------------------------------------------ */
/*  Toolbar button — small helper so we don't repeat class logic      */
/* ------------------------------------------------------------------ */
function TBtn({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        // Prevent the editor from losing focus when clicking toolbar buttons.
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
        active
          ? "bg-[#D73F09] text-white"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Divider between toolbar groups                                    */
/* ------------------------------------------------------------------ */
function TDivider() {
  return <div className="w-px h-5 bg-white/[0.15] mx-1" />;
}

/* ------------------------------------------------------------------ */
/*  Color picker button (for text color or highlight)                 */
/* ------------------------------------------------------------------ */
function ColorBtn({
  value,
  onChange,
  title,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  title: string;
  label: string;
}) {
  return (
    <label title={title} className="relative cursor-pointer px-1">
      <span
        className="inline-block text-xs font-bold"
        style={{ color: value || "#ffffff" }}
      >
        {label}
      </span>
      <input
        type="color"
        value={value || "#ffffff"}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Font size dropdown                                                */
/* ------------------------------------------------------------------ */
const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"];

function FontSizeSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (size: string) => void;
}) {
  return (
    <select
      title="Font size"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className="bg-transparent text-white/70 text-xs border border-white/[0.15] rounded px-1 py-0.5 outline-none focus:border-[#D73F09] cursor-pointer"
    >
      <option value="">Size</option>
      {FONT_SIZES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

/* ================================================================== */
/*  Main component                                                    */
/* ================================================================== */
interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
}: RichTextEditorProps) {
  // Track whether we should skip the next onUpdate (because we're syncing
  // the parent `value` into the editor, not a user edit).
  const suppressUpdate = useRef(false);

  // Track current text color and highlight for the color pickers.
  const [textColor, setTextColor] = useState("#ffffff");
  const [highlightColor, setHighlightColor] = useState("#D73F09");

  const editor = useEditor({
    // Prevent SSR hydration mismatch — TipTap's official fix for Next.js.
    // Without this, TipTap tries to render on the server where there's no DOM,
    // causing a mismatch with what the client renders.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // StarterKit bundles heading, bulletList, orderedList, blockquote, etc.
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false, // Don't navigate in the editor — only on the public recap
        HTMLAttributes: { class: "text-[#D73F09] underline" },
      }),
      Color, // text color via <span style="color:...">
      TextStyle, // required by Color & FontSize
      Highlight.configure({ multicolor: true }), // highlight via <mark>
      Placeholder.configure({ placeholder: placeholder ?? "Start typing..." }),
      FontSize,
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-sm max-w-none px-4 py-3 min-h-[120px] outline-none text-white " +
          // Override default prose colors for headings, links, strong, etc.
          "prose-headings:text-white prose-a:text-[#D73F09] prose-strong:text-white " +
          "prose-blockquote:border-[#D73F09] prose-blockquote:text-white/80",
      },
    },
    onUpdate: ({ editor }) => {
      if (suppressUpdate.current) {
        suppressUpdate.current = false;
        return;
      }
      onChange(editor.getHTML());
    },
  });

  // Sync external value changes into the editor (e.g. when data loads from DB).
  // We only do this when the editor content genuinely differs from the incoming
  // value to avoid resetting the cursor position on every keystroke.
  useEffect(() => {
    if (!editor) return;
    const currentHTML = editor.getHTML();
    // Treat "<p></p>" (TipTap's empty state) as equivalent to ""
    const normalize = (s: string) => (s === "<p></p>" ? "" : s);
    if (normalize(currentHTML) !== normalize(value)) {
      suppressUpdate.current = true;
      editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  /* ---------------------------------------------------------------- */
  /*  Link prompt helper                                              */
  /* ---------------------------------------------------------------- */
  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);
    if (url === null) return; // cancelled
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  if (!editor) return null;

  /* ---------------------------------------------------------------- */
  /*  Toolbar                                                         */
  /* ---------------------------------------------------------------- */
  return (
    <div className="border border-white/[0.15] rounded-lg overflow-hidden bg-[#111]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-white/[0.15] bg-[#0a0a0a]">
        {/* Headings */}
        <TBtn
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          title="Heading 2"
        >
          H2
        </TBtn>
        <TBtn
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          title="Heading 3"
        >
          H3
        </TBtn>

        <TDivider />

        {/* Inline formatting */}
        <TBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          B
        </TBtn>
        <TBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <em>I</em>
        </TBtn>
        <TBtn
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <u>U</u>
        </TBtn>
        <TBtn
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <s>S</s>
        </TBtn>

        <TDivider />

        {/* Lists */}
        <TBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          &bull; List
        </TBtn>
        <TBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          1. List
        </TBtn>

        <TDivider />

        {/* Blockquote */}
        <TBtn
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Block quote"
        >
          &ldquo;&rdquo;
        </TBtn>

        {/* Link */}
        <TBtn
          active={editor.isActive("link")}
          onClick={setLink}
          title="Insert link"
        >
          Link
        </TBtn>

        <TDivider />

        {/* Text color */}
        <ColorBtn
          value={textColor}
          onChange={(color) => {
            setTextColor(color);
            editor.chain().focus().setColor(color).run();
          }}
          title="Text color"
          label="A"
        />

        {/* Highlight */}
        <ColorBtn
          value={highlightColor}
          onChange={(color) => {
            setHighlightColor(color);
            editor.chain().focus().toggleHighlight({ color }).run();
          }}
          title="Highlight color"
          label="H"
        />

        <TDivider />

        {/* Font size */}
        <FontSizeSelect
          value={editor.getAttributes("textStyle").fontSize ?? null}
          onChange={(size) => {
            if (size) {
              editor.chain().focus().setMark("textStyle", { fontSize: size }).run();
            } else {
              editor.chain().focus().unsetMark("textStyle").run();
            }
          }}
        />
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  );
}
