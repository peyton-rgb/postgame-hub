// ============================================================
// RichTextEditor — Tiptap-based rich text editor
//
// Supports two themes: "dark" (original, for dark pages) and
// "light" (for the cream-bg brief editor). Pass variant prop.
// Features: bold, italic, underline, strike, bullet/ordered
// lists, blockquote, links, headings.
// ============================================================

'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { useEffect, useRef, useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Toolbar button                                                     */
/* ------------------------------------------------------------------ */
function TBtn({
  active,
  onClick,
  children,
  title,
  variant,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  variant: 'dark' | 'light';
}) {
  const dark = variant === 'dark';
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
        active
          ? 'bg-[#D73F09] text-white'
          : dark
          ? 'text-white/70 hover:bg-white/10 hover:text-white'
          : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  );
}

function TDivider({ variant }: { variant: 'dark' | 'light' }) {
  return (
    <div
      className={`w-px h-5 mx-1 ${
        variant === 'dark' ? 'bg-white/[0.15]' : 'bg-gray-200'
      }`}
    />
  );
}

/* ================================================================== */
/*  Main component                                                    */
/* ================================================================== */
interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  variant?: 'dark' | 'light';
  minHeight?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  variant = 'dark',
  minHeight = '120px',
}: RichTextEditorProps) {
  const suppressUpdate = useRef(false);
  const dark = variant === 'dark';

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: dark ? 'text-[#D73F09] underline' : 'text-blue-600 underline',
        },
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: dark
          ? `prose prose-invert prose-sm max-w-none px-4 py-3 outline-none text-white prose-headings:text-white prose-a:text-[#D73F09] prose-strong:text-white prose-blockquote:border-[#D73F09] prose-blockquote:text-white/80`
          : `prose prose-sm max-w-none px-4 py-3 outline-none text-gray-900 prose-headings:text-gray-900 prose-a:text-blue-600 prose-strong:text-gray-900 prose-blockquote:border-[#D73F09] prose-blockquote:text-gray-600`,
        style: `min-height: ${minHeight}`,
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

  useEffect(() => {
    if (!editor) return;
    const currentHTML = editor.getHTML();
    const normalize = (s: string) => (s === '<p></p>' ? '' : s);
    if (normalize(currentHTML) !== normalize(value)) {
      suppressUpdate.current = true;
      editor.commands.setContent(value || '');
    }
  }, [value, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url })
      .run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      className={`rounded-xl overflow-hidden border ${
        dark
          ? 'border-white/[0.15] bg-[#111]'
          : 'border-gray-200 bg-white'
      }`}
    >
      {/* Toolbar */}
      <div
        className={`flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b ${
          dark
            ? 'border-white/[0.15] bg-[#0a0a0a]'
            : 'border-gray-100 bg-gray-50'
        }`}
      >
        <TBtn
          variant={variant}
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <strong>B</strong>
        </TBtn>
        <TBtn
          variant={variant}
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <em>I</em>
        </TBtn>

        <TDivider variant={variant} />

        <TBtn
          variant={variant}
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          &bull; List
        </TBtn>
        <TBtn
          variant={variant}
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          1. List
        </TBtn>

        <TDivider variant={variant} />

        <TBtn
          variant={variant}
          active={editor.isActive('link')}
          onClick={setLink}
          title="Insert link"
        >
          Link
        </TBtn>
        <TBtn
          variant={variant}
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Block quote"
        >
          &ldquo;&rdquo;
        </TBtn>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  );
}
