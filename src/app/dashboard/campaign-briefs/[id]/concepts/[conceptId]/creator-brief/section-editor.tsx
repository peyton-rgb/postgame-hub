// ============================================================
// SectionEditor — per-type inline edit form for a CreatorBriefSection.
// Uses RichTextEditor for long-form text fields (description,
// visual style, lighting notes, etc.) and plain inputs for short
// values like titles, counts, URLs.
// ============================================================

'use client';

import dynamic from 'next/dynamic';
import type { CreatorBriefSection } from '@/lib/types/briefs';

// Dynamically import RichTextEditor to avoid SSR issues with Tiptap
const RichTextEditor = dynamic(
  () => import('@/components/RichTextEditor'),
  { ssr: false, loading: () => <div className="h-32 bg-gray-50 rounded-xl animate-pulse" /> },
);

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#D73F09]/30"
    />
  );
}

function StringList({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      {(items || []).map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="text"
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={placeholder}
            className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#D73F09]/30"
          />
          <button
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="text-gray-400 hover:text-red-500 px-2 text-sm"
            aria-label="Remove"
          >
            &times;
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...(items || []), ''])}
        className="text-xs text-[#D73F09] hover:text-[#b33507] font-medium"
      >
        + Add
      </button>
    </div>
  );
}

interface Props {
  section: CreatorBriefSection;
  onChange: (next: CreatorBriefSection) => void;
}

export default function SectionEditor({ section, onChange }: Props) {
  function setContent(content: unknown) {
    onChange({ ...section, content } as CreatorBriefSection);
  }

  switch (section.type) {
    case 'concept': {
      const { description, callout } = section.content;
      return (
        <div className="space-y-4">
          <Field label="Description">
            <RichTextEditor
              value={description}
              onChange={(v) => setContent({ ...section.content, description: v })}
              variant="light"
              placeholder="Describe the concept..."
            />
          </Field>
          <Field label="Callout (optional)">
            <div className="space-y-2">
              <TextInput
                value={callout?.title || ''}
                onChange={(v) =>
                  setContent({
                    ...section.content,
                    callout: { ...(callout || { title: '', text: '' }), title: v },
                  })
                }
                placeholder="Callout title (e.g. SAME-DAY DELIVERY)"
              />
              <TextInput
                value={callout?.text || ''}
                onChange={(v) =>
                  setContent({
                    ...section.content,
                    callout: { ...(callout || { title: '', text: '' }), text: v },
                  })
                }
                placeholder="Callout body text"
              />
              {callout && (
                <button
                  onClick={() => {
                    const { callout: _omit, ...rest } = section.content;
                    setContent(rest);
                  }}
                  className="text-xs text-gray-400 hover:text-red-500"
                >
                  Remove callout
                </button>
              )}
            </div>
          </Field>
        </div>
      );
    }

    case 'photos': {
      const { description, images } = section.content;
      return (
        <div className="space-y-4">
          <Field label="Description">
            <RichTextEditor
              value={description}
              onChange={(v) => setContent({ ...section.content, description: v })}
              variant="light"
              minHeight="80px"
            />
          </Field>
          <Field label="Images">
            <div className="space-y-2">
              {(images || []).map((img, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      value={img.url}
                      onChange={(e) => {
                        const next = [...images];
                        next[i] = { ...img, url: e.target.value };
                        setContent({ ...section.content, images: next });
                      }}
                      placeholder="https://..."
                      className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm font-mono"
                    />
                    <input
                      type="text"
                      value={img.caption || ''}
                      onChange={(e) => {
                        const next = [...images];
                        next[i] = { ...img, caption: e.target.value };
                        setContent({ ...section.content, images: next });
                      }}
                      placeholder="Caption (optional)"
                      className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm"
                    />
                  </div>
                  <button
                    onClick={() =>
                      setContent({
                        ...section.content,
                        images: images.filter((_, idx) => idx !== i),
                      })
                    }
                    className="text-gray-400 hover:text-red-500 px-2"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  setContent({
                    ...section.content,
                    images: [...(images || []), { url: '', caption: '' }],
                  })
                }
                className="text-xs text-[#D73F09] hover:text-[#b33507] font-medium"
              >
                + Add image
              </button>
            </div>
          </Field>
        </div>
      );
    }

    case 'videos': {
      const { description, videos } = section.content;
      return (
        <div className="space-y-4">
          <Field label="Description">
            <RichTextEditor
              value={description}
              onChange={(v) => setContent({ ...section.content, description: v })}
              variant="light"
              minHeight="80px"
            />
          </Field>
          <Field label="Videos">
            <div className="space-y-2">
              {(videos || []).map((v, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      value={v.url}
                      onChange={(e) => {
                        const next = [...videos];
                        next[i] = { ...v, url: e.target.value };
                        setContent({ ...section.content, videos: next });
                      }}
                      placeholder="https://..."
                      className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm font-mono"
                    />
                    <input
                      type="text"
                      value={v.caption || ''}
                      onChange={(e) => {
                        const next = [...videos];
                        next[i] = { ...v, caption: e.target.value };
                        setContent({ ...section.content, videos: next });
                      }}
                      placeholder="Caption (optional)"
                      className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm"
                    />
                  </div>
                  <button
                    onClick={() =>
                      setContent({
                        ...section.content,
                        videos: videos.filter((_, idx) => idx !== i),
                      })
                    }
                    className="text-gray-400 hover:text-red-500 px-2"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  setContent({
                    ...section.content,
                    videos: [...(videos || []), { url: '', caption: '' }],
                  })
                }
                className="text-xs text-[#D73F09] hover:text-[#b33507] font-medium"
              >
                + Add video
              </button>
            </div>
          </Field>
        </div>
      );
    }

    case 'deliverables': {
      const { video, photography } = section.content;
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="text-xs font-bold text-[#D73F09] uppercase tracking-wider">VIDEO</div>
            <TextInput value={video?.title || ''} onChange={(v) => setContent({ ...section.content, video: { ...(video || { title: '', count: '', description: '', orientation: '' }), title: v } })} placeholder="Title" />
            <TextInput value={video?.count || ''} onChange={(v) => setContent({ ...section.content, video: { ...(video || { title: '', count: '', description: '', orientation: '' }), count: v } })} placeholder="Count (e.g. 1 x Video)" />
            <TextInput value={video?.description || ''} onChange={(v) => setContent({ ...section.content, video: { ...(video || { title: '', count: '', description: '', orientation: '' }), description: v } })} placeholder="Description" />
            <TextInput value={video?.orientation || ''} onChange={(v) => setContent({ ...section.content, video: { ...(video || { title: '', count: '', description: '', orientation: '' }), orientation: v } })} placeholder="Orientation (e.g. 9:16 vertical)" />
          </div>
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="text-xs font-bold text-[#D73F09] uppercase tracking-wider">PHOTOGRAPHY</div>
            <TextInput value={photography?.title || ''} onChange={(v) => setContent({ ...section.content, photography: { ...(photography || { title: '', minimum: '', style: '' }), title: v } })} placeholder="Title" />
            <TextInput value={photography?.minimum || ''} onChange={(v) => setContent({ ...section.content, photography: { ...(photography || { title: '', minimum: '', style: '' }), minimum: v } })} placeholder="Minimum (e.g. 15-25 photos)" />
            <TextInput value={photography?.style || ''} onChange={(v) => setContent({ ...section.content, photography: { ...(photography || { title: '', minimum: '', style: '' }), style: v } })} placeholder="Style" />
          </div>
        </div>
      );
    }

    case 'product_reqs': {
      const { items } = section.content;
      return (
        <div className="space-y-3">
          {(items || []).map((item, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...item, name: e.target.value };
                    setContent({ ...section.content, items: next });
                  }}
                  placeholder="Product name"
                  className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm"
                />
                <button
                  onClick={() => setContent({ ...section.content, items: items.filter((_, idx) => idx !== i) })}
                  className="text-gray-400 hover:text-red-500 px-2"
                >
                  &times;
                </button>
              </div>
              <Field label="Requirements">
                <StringList
                  items={item.requirements || []}
                  onChange={(reqs) => {
                    const next = [...items];
                    next[i] = { ...item, requirements: reqs };
                    setContent({ ...section.content, items: next });
                  }}
                  placeholder="Requirement"
                />
              </Field>
            </div>
          ))}
          <button
            onClick={() => setContent({ ...section.content, items: [...(items || []), { name: '', requirements: [] }] })}
            className="text-xs text-[#D73F09] hover:text-[#b33507] font-medium"
          >
            + Add product
          </button>
        </div>
      );
    }

    case 'athlete_reqs': {
      const { requirements, tip } = section.content;
      return (
        <div className="space-y-4">
          <Field label="Requirements">
            <StringList
              items={requirements || []}
              onChange={(next) => setContent({ ...section.content, requirements: next })}
              placeholder="Requirement"
            />
          </Field>
          <Field label="Pro Tip (optional)">
            <div className="space-y-2">
              <TextInput
                value={tip?.title || ''}
                onChange={(v) => setContent({ ...section.content, tip: { ...(tip || { title: '', text: '' }), title: v } })}
                placeholder="Tip title (e.g. Pro Tip)"
              />
              <TextInput
                value={tip?.text || ''}
                onChange={(v) => setContent({ ...section.content, tip: { ...(tip || { title: '', text: '' }), text: v } })}
                placeholder="Tip body"
              />
              {tip && (
                <button
                  onClick={() => { const { tip: _omit, ...rest } = section.content; setContent(rest); }}
                  className="text-xs text-gray-400 hover:text-red-500"
                >
                  Remove tip
                </button>
              )}
            </div>
          </Field>
        </div>
      );
    }

    case 'creative_direction': {
      const { tone, visual_style, lighting_notes } = section.content;
      return (
        <div className="space-y-4">
          <Field label="Tone (badges)">
            <StringList
              items={tone || []}
              onChange={(next) => setContent({ ...section.content, tone: next })}
              placeholder='e.g. "Confident & Game-Ready"'
            />
          </Field>
          <Field label="Visual Style">
            <RichTextEditor
              value={visual_style}
              onChange={(v) => setContent({ ...section.content, visual_style: v })}
              variant="light"
              minHeight="80px"
            />
          </Field>
          <Field label="Lighting Notes">
            <RichTextEditor
              value={lighting_notes}
              onChange={(v) => setContent({ ...section.content, lighting_notes: v })}
              variant="light"
              minHeight="80px"
            />
          </Field>
        </div>
      );
    }

    case 'camera_specs': {
      const { video_settings, photography_settings, lens_recommendation } = section.content;
      function setVS(key: string, v: string) {
        setContent({ ...section.content, video_settings: { ...video_settings, [key]: v } });
      }
      function setPS(key: string, v: string) {
        setContent({ ...section.content, photography_settings: { ...photography_settings, [key]: v } });
      }
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-[#D73F09] uppercase tracking-wider">VIDEO SETTINGS</div>
              <TextInput value={video_settings?.frame_rate || ''} onChange={(v) => setVS('frame_rate', v)} placeholder="Frame rate" />
              <TextInput value={video_settings?.resolution || ''} onChange={(v) => setVS('resolution', v)} placeholder="Resolution" />
              <TextInput value={video_settings?.orientation || ''} onChange={(v) => setVS('orientation', v)} placeholder="Orientation" />
              <TextInput value={video_settings?.stabilization || ''} onChange={(v) => setVS('stabilization', v)} placeholder="Stabilization" />
              <TextInput value={video_settings?.color_profile || ''} onChange={(v) => setVS('color_profile', v)} placeholder="Color profile" />
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-[#D73F09] uppercase tracking-wider">PHOTO SETTINGS</div>
              <TextInput value={photography_settings?.format || ''} onChange={(v) => setPS('format', v)} placeholder="Format" />
              <TextInput value={photography_settings?.shutter_speed || ''} onChange={(v) => setPS('shutter_speed', v)} placeholder="Shutter speed" />
              <TextInput value={photography_settings?.aperture || ''} onChange={(v) => setPS('aperture', v)} placeholder="Aperture" />
              <TextInput value={photography_settings?.mode || ''} onChange={(v) => setPS('mode', v)} placeholder="Mode" />
            </div>
          </div>
          <Field label="Lens Recommendation">
            <RichTextEditor
              value={lens_recommendation}
              onChange={(v) => setContent({ ...section.content, lens_recommendation: v })}
              variant="light"
              minHeight="60px"
            />
          </Field>
        </div>
      );
    }

    case 'workflow': {
      const { steps } = section.content;
      return (
        <div className="space-y-3">
          {(steps || []).map((step, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={step.number ?? i + 1}
                  onChange={(e) => {
                    const next = [...steps];
                    next[i] = { ...step, number: Number(e.target.value) };
                    setContent({ ...section.content, steps: next });
                  }}
                  className="w-16 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm"
                />
                <input
                  type="text"
                  value={step.title}
                  onChange={(e) => {
                    const next = [...steps];
                    next[i] = { ...step, title: e.target.value };
                    setContent({ ...section.content, steps: next });
                  }}
                  placeholder="Step title"
                  className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm"
                />
                <button
                  onClick={() => setContent({ ...section.content, steps: steps.filter((_, idx) => idx !== i) })}
                  className="text-gray-400 hover:text-red-500 px-2"
                >
                  &times;
                </button>
              </div>
              <RichTextEditor
                value={step.description}
                onChange={(v) => {
                  const next = [...steps];
                  next[i] = { ...step, description: v };
                  setContent({ ...section.content, steps: next });
                }}
                variant="light"
                minHeight="60px"
              />
            </div>
          ))}
          <button
            onClick={() =>
              setContent({
                ...section.content,
                steps: [
                  ...(steps || []),
                  { number: (steps?.length || 0) + 1, title: '', description: '' },
                ],
              })
            }
            className="text-xs text-[#D73F09] hover:text-[#b33507] font-medium"
          >
            + Add step
          </button>
        </div>
      );
    }

    case 'dos_donts': {
      const { dos, donts } = section.content;
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Do's">
            <StringList
              items={dos || []}
              onChange={(next) => setContent({ ...section.content, dos: next })}
              placeholder="Do this"
            />
          </Field>
          <Field label="Don'ts">
            <StringList
              items={donts || []}
              onChange={(next) => setContent({ ...section.content, donts: next })}
              placeholder="Don't do this"
            />
          </Field>
        </div>
      );
    }

    case 'file_delivery': {
      const { video_specs, photo_specs, delivery_method, deadline } = section.content;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-[#D73F09] uppercase tracking-wider">VIDEO SPECS</div>
              <TextInput value={video_specs?.format || ''} onChange={(v) => setContent({ ...section.content, video_specs: { ...video_specs, format: v } })} placeholder="Format" />
              <TextInput value={video_specs?.resolution || ''} onChange={(v) => setContent({ ...section.content, video_specs: { ...video_specs, resolution: v } })} placeholder="Resolution" />
              <TextInput value={video_specs?.color_profile || ''} onChange={(v) => setContent({ ...section.content, video_specs: { ...video_specs, color_profile: v } })} placeholder="Color profile" />
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-[#D73F09] uppercase tracking-wider">PHOTO SPECS</div>
              <TextInput value={photo_specs?.format || ''} onChange={(v) => setContent({ ...section.content, photo_specs: { ...photo_specs, format: v } })} placeholder="Format" />
              <TextInput value={photo_specs?.color_grading || ''} onChange={(v) => setContent({ ...section.content, photo_specs: { ...photo_specs, color_grading: v } })} placeholder="Color grading" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Delivery Method">
              <RichTextEditor
                value={delivery_method}
                onChange={(v) => setContent({ ...section.content, delivery_method: v })}
                variant="light"
                minHeight="60px"
              />
            </Field>
            <Field label="Deadline">
              <TextInput
                value={deadline}
                onChange={(v) => setContent({ ...section.content, deadline: v })}
                placeholder="e.g. Same-day upload mandatory"
              />
            </Field>
          </div>
        </div>
      );
    }

    default:
      return (
        <p className="text-sm text-gray-400 italic">
          Unknown section type. Edit raw JSON if needed.
        </p>
      );
  }
}
