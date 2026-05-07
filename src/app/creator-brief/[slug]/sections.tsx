// ============================================================
// BriefSections — renders the typed CreatorBriefSection union as
// a mood-board styled article. Used by the public page only.
// ============================================================

import type {
  CreatorBriefSection,
  ConceptSectionContent,
  PhotosSectionContent,
  VideosSectionContent,
  DeliverablesSectionContent,
  ProductReqsSectionContent,
  AthleteReqsSectionContent,
  CreativeDirectionSectionContent,
  CameraSpecsSectionContent,
  WorkflowSectionContent,
  DosDontsSectionContent,
  FileDeliverySectionContent,
} from '@/lib/types/briefs';

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
    case 'concept': {
      const c = section.content as ConceptSectionContent;
      return (
        <>
          <p className="text-base leading-relaxed text-gray-800">
            {c.description}
          </p>
          {c.callout && (
            <Callout
              title={c.callout.title}
              text={c.callout.text}
              brandColor={brandColor}
            />
          )}
        </>
      );
    }

    case 'photos': {
      const c = section.content as PhotosSectionContent;
      return (
        <>
          <p className="text-base leading-relaxed text-gray-800">
            {c.description}
          </p>
          <PhotoGrid images={c.images || []} />
        </>
      );
    }

    case 'videos': {
      const c = section.content as VideosSectionContent;
      return (
        <>
          <p className="text-base leading-relaxed text-gray-800">
            {c.description}
          </p>
          {(c.videos || []).length > 0 && (
            <ul className="mt-5 space-y-2">
              {c.videos.map((v: { url: string; caption?: string }, i: number) => (
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
    }

    case 'deliverables': {
      const c = section.content as DeliverablesSectionContent;
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {c.video && (
            <div className="bg-gray-50 rounded-xl p-5 border border-black/5">
              <div
                className="text-xs font-black tracking-widest"
                style={{ color: brandColor }}
              >
                VIDEO
              </div>
              <h3 className="text-lg font-bold mt-1">{c.video.title}</h3>
              <p className="text-sm text-gray-700 mt-1">{c.video.count}</p>
              <p className="text-sm text-gray-600 mt-3">{c.video.description}</p>
              <p className="text-xs text-gray-500 mt-3 uppercase tracking-wider">
                Orientation: {c.video.orientation}
              </p>
            </div>
          )}
          {c.photography && (
            <div className="bg-gray-50 rounded-xl p-5 border border-black/5">
              <div
                className="text-xs font-black tracking-widest"
                style={{ color: brandColor }}
              >
                PHOTOGRAPHY
              </div>
              <h3 className="text-lg font-bold mt-1">{c.photography.title}</h3>
              <p className="text-sm text-gray-700 mt-1">
                Minimum: {c.photography.minimum}
              </p>
              <p className="text-sm text-gray-600 mt-3">{c.photography.style}</p>
            </div>
          )}
        </div>
      );
    }

    case 'product_reqs': {
      const c = section.content as ProductReqsSectionContent;
      return (
        <ul className="space-y-5">
          {(c.items || []).map((item: { name: string; requirements: string[] }, i: number) => (
            <li key={i}>
              <div className="font-bold">{item.name}</div>
              <ul className="mt-2 space-y-1.5 text-sm text-gray-700 list-disc pl-5">
                {(item.requirements || []).map((r: string, j: number) => (
                  <li key={j}>{r}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      );
    }

    case 'athlete_reqs': {
      const c = section.content as AthleteReqsSectionContent;
      return (
        <>
          <ul className="space-y-1.5 text-sm text-gray-700 list-disc pl-5">
            {(c.requirements || []).map((r: string, i: number) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          {c.tip && (
            <div
              className="mt-5 rounded-xl p-5 border-l-4"
              style={{ backgroundColor: '#fff7ed', borderColor: brandColor }}
            >
              <div className="text-xs font-black tracking-widest" style={{ color: brandColor }}>
                {c.tip.title.toUpperCase()}
              </div>
              <div className="mt-1 text-sm text-gray-800">{c.tip.text}</div>
            </div>
          )}
        </>
      );
    }

    case 'creative_direction': {
      const c = section.content as CreativeDirectionSectionContent;
      return (
        <>
          {c.tone?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {c.tone.map((t: string, i: number) => (
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
          {c.visual_style && (
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
                Visual Style
              </div>
              <p className="text-sm text-gray-800">{c.visual_style}</p>
            </div>
          )}
          {c.lighting_notes && (
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
                Lighting
              </div>
              <p className="text-sm text-gray-800">{c.lighting_notes}</p>
            </div>
          )}
        </>
      );
    }

    case 'camera_specs': {
      const c = section.content as CameraSpecsSectionContent;
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-gray-50 rounded-xl p-5 border border-black/5">
            <div className="text-xs font-black tracking-widest mb-3" style={{ color: brandColor }}>
              VIDEO SETTINGS
            </div>
            <SpecRow label="Frame Rate" value={c.video_settings?.frame_rate} />
            <SpecRow label="Resolution" value={c.video_settings?.resolution} />
            <SpecRow label="Orientation" value={c.video_settings?.orientation} />
            <SpecRow label="Stabilization" value={c.video_settings?.stabilization} />
            <SpecRow label="Color Profile" value={c.video_settings?.color_profile} />
          </div>
          <div className="bg-gray-50 rounded-xl p-5 border border-black/5">
            <div className="text-xs font-black tracking-widest mb-3" style={{ color: brandColor }}>
              PHOTO SETTINGS
            </div>
            <SpecRow label="Format" value={c.photography_settings?.format} />
            <SpecRow label="Shutter" value={c.photography_settings?.shutter_speed} />
            <SpecRow label="Aperture" value={c.photography_settings?.aperture} />
            <SpecRow label="Mode" value={c.photography_settings?.mode} />
          </div>
          {c.lens_recommendation && (
            <div className="md:col-span-2">
              <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
                Lens Recommendation
              </div>
              <p className="text-sm text-gray-800">{c.lens_recommendation}</p>
            </div>
          )}
        </div>
      );
    }

    case 'workflow': {
      const c = section.content as WorkflowSectionContent;
      return <StepList items={c.steps || []} brandColor={brandColor} />;
    }

    case 'dos_donts': {
      const c = section.content as DosDontsSectionContent;
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-black tracking-widest mb-3" style={{ color: '#16a34a' }}>
              DO
            </div>
            <ul className="space-y-2">
              {c.dos.map((d: string, i: number) => (
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
              {c.donts.map((d: string, i: number) => (
                <li key={i} className="flex gap-3 text-sm text-gray-800">
                  <span style={{ color: '#dc2626' }} className="font-black">✕</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    }

    case 'file_delivery': {
      const c = section.content as FileDeliverySectionContent;
      return (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-gray-50 rounded-xl p-5 border border-black/5">
              <div className="text-xs font-black tracking-widest mb-3" style={{ color: brandColor }}>
                VIDEO SPECS
              </div>
              <SpecRow label="Format" value={c.video_specs?.format} />
              <SpecRow label="Resolution" value={c.video_specs?.resolution} />
              <SpecRow label="Color" value={c.video_specs?.color_profile} />
            </div>
            <div className="bg-gray-50 rounded-xl p-5 border border-black/5">
              <div className="text-xs font-black tracking-widest mb-3" style={{ color: brandColor }}>
                PHOTO SPECS
              </div>
              <SpecRow label="Format" value={c.photo_specs?.format} />
              <SpecRow label="Color Grading" value={c.photo_specs?.color_grading} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
                Delivery Method
              </div>
              <p className="text-sm text-gray-800">{c.delivery_method}</p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
                Deadline
              </div>
              <p className="text-sm font-bold" style={{ color: brandColor }}>
                {c.deadline}
              </p>
            </div>
          </div>
        </>
      );
    }

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
