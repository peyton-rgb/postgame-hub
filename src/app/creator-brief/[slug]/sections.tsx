// ============================================================
// BriefSections — renders the typed CreatorBriefSection union as
// a mood-board styled article. Used by the public page only.
// ============================================================

import type { CreatorBriefSection } from '@/lib/types/briefs';

function SectionShell({
  number,
  title,
  brandColor,
  children,
}: {
  number: string;
  title: string;
  brandColor: string;
  children: React.ReactNode;
}) {
  return (
    <article className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
      <header className="px-7 sm:px-10 pt-8 pb-4">
        <div className="flex items-baseline gap-4">
          <span
            className="text-3xl font-black tracking-tight"
            style={{ color: brandColor }}
          >
            {number}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            {title}
          </h2>
        </div>
        <div
          className="h-1 w-16 mt-4 rounded-full"
          style={{ backgroundColor: brandColor }}
        />
      </header>
      <div className="px-7 sm:px-10 pb-9 pt-2">{children}</div>
    </article>
  );
}

function Callout({
  title,
  text,
  brandColor,
}: {
  title: string;
  text: string;
  brandColor: string;
}) {
  return (
    <div
      className="mt-5 rounded-xl p-5 text-white"
      style={{ backgroundColor: brandColor }}
    >
      <div className="text-xs font-black tracking-widest opacity-90">{title}</div>
      <div className="mt-1 text-sm sm:text-base font-semibold">{text}</div>
    </div>
  );
}

function PhotoGrid({
  images,
}: {
  images: { url: string; caption?: string }[];
}) {
  if (images.length === 0) return null;
  return (
    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
      {images.map((img, i) => (
        <figure
          key={i}
          className="border border-dashed border-black/20 rounded-lg p-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.url}
            alt={img.caption || `Reference ${i + 1}`}
            className="w-full aspect-[4/3] object-cover rounded-md"
          />
          {img.caption && (
            <figcaption className="mt-2 text-xs text-gray-500 text-center">
              {img.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

function StepList({
  items,
  brandColor,
}: {
  items: { number: number; title: string; description: string }[];
  brandColor: string;
}) {
  return (
    <ol className="mt-5 space-y-4">
      {items.map((step, i) => (
        <li key={i} className="flex gap-4">
          <div
            className="flex-shrink-0 w-9 h-9 rounded-full text-white font-black flex items-center justify-center text-sm"
            style={{ backgroundColor: brandColor }}
          >
            {step.number ?? i + 1}
          </div>
          <div>
            <div className="font-bold">{step.title}</div>
            <div className="text-sm text-gray-600 mt-1">{step.description}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function SpecRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 py-2 border-b border-black/5 last:border-0">
      <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold pt-0.5">
        {label}
      </div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function SectionBody({
  section,
  brandColor,
}: {
  section: CreatorBriefSection;
  brandColor: string;
}) {
  switch (section.type) {
    case 'concept':
      return (
        <>
          <p className="text-base leading-relaxed text-gray-800">
            {section.content.description}
          </p>
          {section.content.callout && (
            <Callout
              title={section.content.callout.title}
              text={section.content.callout.text}
              brandColor={brandColor}
            />
          )}
        </>
      );

    case 'photos':
      return (
        <>
          <p className="text-base leading-relaxed text-gray-800">
            {section.content.description}
          </p>
          <PhotoGrid images={section.content.images || []} />
        </>
      );

    case 'videos':
      return (
        <>
          <p className="text-base leading-relaxed text-gray-800">
            {section.content.description}
          </p>
          {(section.content.videos || []).length > 0 && (
            <ul className="mt-5 space-y-2">
              {section.content.videos.map((v, i) => (
                <li key={i}>
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold underline"
                    style={{ color: brandColor }}
                  >
                    {v.caption || v.url}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      );

    case 'deliverables':
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {section.content.video && (
            <div className="bg-gray-50 rounded-xl p-5 border border-black/5">
              <div
                className="text-xs font-black tracking-widest"
                style={{ color: brandColor }}
              >
                VIDEO
              </div>
              <h3 className="text-lg font-bold mt-1">{section.content.video.title}</h3>
              <p className="text-sm text-gray-700 mt-1">{section.content.video.count}</p>
              <p className="text-sm text-gray-600 mt-3">{section.content.video.description}</p>
              <p className="text-xs text-gray-500 mt-3 uppercase tracking-wider">
                Orientation: {section.content.video.orientation}
              </p>
            </div>
          )}
          {section.content.photography && (
            <div className="bg-gray-50 rounded-xl p-5 border border-black/5">
              <div
                className="text-xs font-black tracking-widest"
                style={{ color: brandColor }}
              >
                PHOTOGRAPHY
              </div>
              <h3 className="text-lg font-bold mt-1">{section.content.photography.title}</h3>
              <p className="text-sm text-gray-700 mt-1">
                Minimum: {section.content.photography.minimum}
              </p>
              <p className="text-sm text-gray-600 mt-3">{section.content.photography.style}</p>
            </div>
          )}
        </div>
      );

    case 'product_reqs':
      return (
        <ul className="space-y-5">
          {section.content.items.map((item, i) => (
            <li key={i}>
              <div className="font-bold">{item.name}</div>
              <ul className="mt-2 space-y-1.5 text-sm text-gray-700 list-disc pl-5">
                {item.requirements.map((r, j) => (
                  <li key={j}>{r}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      );

    case 'athlete_reqs':
      return (
        <>
          <ul className="space-y-1.5 text-sm text-gray-700 list-disc pl-5">
            {section.content.requirements.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          {section.content.tip && (
            <div
              className="mt-5 rounded-xl p-5 border-l-4"
              style={{ backgroundColor: '#fff7ed', borderColor: brandColor }}
            >
              <div className="text-xs font-black tracking-widest" style={{ color: brandColor }}>
                {section.content.tip.title.toUpperCase()}
              </div>
              <div className="mt-1 text-sm text-gray-800">{section.content.tip.text}</div>
            </div>
          )}
        </>
      );

    case 'creative_direction':
      return (
        <>
          {section.content.tone?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {section.content.tone.map((t, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 rounded-full text-xs font-bold border"
                  style={{ borderColor: brandColor, color: brandColor }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          {section.content.visual_style && (
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
                Visual Style
              </div>
              <p className="text-sm text-gray-800">{section.content.visual_style}</p>
            </div>
          )}
          {section.content.lighting_notes && (
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
                Lighting
              </div>
              <p className="text-sm text-gray-800">{section.content.lighting_notes}</p>
            </div>
          )}
        </>
      );

    case 'camera_specs':
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-gray-50 rounded-xl p-5 border border-black/5">
            <div className="text-xs font-black tracking-widest mb-3" style={{ color: brandColor }}>
              VIDEO SETTINGS
            </div>
            <SpecRow label="Frame Rate" value={section.content.video_settings?.frame_rate} />
            <SpecRow label="Resolution" value={section.content.video_settings?.resolution} />
            <SpecRow label="Orientation" value={section.content.video_settings?.orientation} />
            <SpecRow label="Stabilization" value={section.content.video_settings?.stabilization} />
            <SpecRow label="Color Profile" value={section.content.video_settings?.color_profile} />
          </div>
          <div className="bg-gray-50 rounded-xl p-5 border border-black/5">
            <div className="text-xs font-black tracking-widest mb-3" style={{ color: brandColor }}>
              PHOTO SETTINGS
            </div>
            <SpecRow label="Format" value={section.content.photography_settings?.format} />
            <SpecRow label="Shutter" value={section.content.photography_settings?.shutter_speed} />
            <SpecRow label="Aperture" value={section.content.photography_settings?.aperture} />
            <SpecRow label="Mode" value={section.content.photography_settings?.mode} />
          </div>
          {section.content.lens_recommendation && (
            <div className="md:col-span-2">
              <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
                Lens Recommendation
              </div>
              <p className="text-sm text-gray-800">{section.content.lens_recommendation}</p>
            </div>
          )}
        </div>
      );

    case 'workflow':
      return <StepList items={section.content.steps || []} brandColor={brandColor} />;

    case 'dos_donts':
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-black tracking-widest mb-3" style={{ color: '#16a34a' }}>
              DO
            </div>
            <ul className="space-y-2">
              {section.content.dos.map((d, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-800">
                  <span style={{ color: '#16a34a' }} className="font-black">✓</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs font-black tracking-widest mb-3" style={{ color: '#dc2626' }}>
              DON&apos;T
            </div>
            <ul className="space-y-2">
              {section.content.donts.map((d, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-800">
                  <span style={{ color: '#dc2626' }} className="font-black">✕</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );

    case 'file_delivery':
      return (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-gray-50 rounded-xl p-5 border border-black/5">
              <div className="text-xs font-black tracking-widest mb-3" style={{ color: brandColor }}>
                VIDEO SPECS
              </div>
              <SpecRow label="Format" value={section.content.video_specs?.format} />
              <SpecRow label="Resolution" value={section.content.video_specs?.resolution} />
              <SpecRow label="Color" value={section.content.video_specs?.color_profile} />
            </div>
            <div className="bg-gray-50 rounded-xl p-5 border border-black/5">
              <div className="text-xs font-black tracking-widest mb-3" style={{ color: brandColor }}>
                PHOTO SPECS
              </div>
              <SpecRow label="Format" value={section.content.photo_specs?.format} />
              <SpecRow label="Color Grading" value={section.content.photo_specs?.color_grading} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
                Delivery Method
              </div>
              <p className="text-sm text-gray-800">{section.content.delivery_method}</p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
                Deadline
              </div>
              <p className="text-sm font-bold" style={{ color: brandColor }}>
                {section.content.deadline}
              </p>
            </div>
          </div>
        </>
      );

    default:
      // Forward-compat: an unknown section type is rendered as JSON.
      return (
        <pre className="text-xs text-gray-500 overflow-x-auto">
          {JSON.stringify((section as { content: unknown }).content, null, 2)}
        </pre>
      );
  }
}

export default function BriefSections({
  sections,
  brandColor,
}: {
  sections: CreatorBriefSection[];
  brandColor: string;
}) {
  return (
    <>
      {sections.map((section, i) => (
        <SectionShell
          key={`${section.number}-${i}`}
          number={section.number}
          title={section.title}
          brandColor={brandColor}
        >
          <SectionBody section={section} brandColor={brandColor} />
        </SectionShell>
      ))}
    </>
  );
}
