// ============================================================
// Public Creator Brief — /creator-brief/[slug]
//
// The money page. A beautiful, visual mood board that the
// videographer opens on their phone on the way to a shoot.
// No auth required — RLS allows public SELECT on published briefs.
//
// Section 00 (Shoot Logistics) renders as a header card with
// date, time, location, and contact info front and center.
// ============================================================

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type {
  CreatorBrief,
  CreatorBriefSection,
  AthleteProfile,
  ShootLogisticsContent,
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

// ---- Rich HTML renderer (renders HTML from the rich text editor) ----
function RichContent({ html, className = '' }: { html: string; className?: string }) {
  if (!html || html === '<p></p>') return null;
  return (
    <div
      className={`prose max-w-none text-gray-700 text-[15px] leading-relaxed font-[450] prose-headings:text-gray-900 prose-a:text-blue-600 prose-strong:text-gray-900 prose-blockquote:border-gray-300 prose-blockquote:text-gray-600 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Instagram icon (inline SVG)
function InstagramIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

// ---- Athlete Profile Card ----
function AthleteProfileCard({ profile, color }: { profile: AthleteProfile; color: string }) {
  if (!profile.name && !profile.photo_url) return null;
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 mb-8">
      <div className="flex items-center gap-3 mb-4">
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: color }}
        >
          ★
        </span>
        <h2 className="text-xl font-bold text-gray-900">Athlete Profile</h2>
      </div>
      <hr className="mb-5" style={{ borderColor: color, opacity: 0.3 }} />
      <div className="flex flex-col sm:flex-row gap-6">
        {profile.photo_url && (
          <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-xl overflow-hidden flex-shrink-0 border border-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={profile.photo_url}
              alt={profile.name || 'Athlete'}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 space-y-2">
          {profile.name && (
            <h3 className="text-xl font-bold text-gray-900">{profile.name}</h3>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
            {profile.sport && <span>{profile.sport}</span>}
            {profile.school && <span>{profile.school}</span>}
            {profile.year && <span>{profile.year}</span>}
          </div>
          {profile.instagram && (
            <a
              href={`https://instagram.com/${profile.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#D73F09] hover:underline"
            >
              <InstagramIcon className="w-4 h-4" />
              @{profile.instagram}
            </a>
          )}
          {profile.bio && (
            <p className="text-gray-600 text-sm leading-relaxed mt-2">{profile.bio}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Section Renderers ----

function ShootLogisticsSection({ content, color }: { content: ShootLogisticsContent; color: string }) {
  const contacts = content.postgame_contacts || [];
  const hasContacts = contacts.length > 0 || content.videographer;
  const hasSchedule = content.shoot_date || content.shoot_time || content.location;

  if (!hasSchedule && !hasContacts) return null;

  // Format the date nicely
  const formattedDate = content.shoot_date
    ? new Date(content.shoot_date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      })
    : null;

  // Format time to 12-hour
  const formattedTime = content.shoot_time
    ? new Date(`2000-01-01T${content.shoot_time}`).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true,
      })
    : null;

  return (
    <div>
      {/* Date / Time / Location */}
      {hasSchedule && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {formattedDate && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Date</div>
              <div className="text-gray-900 font-semibold">{formattedDate}</div>
            </div>
          )}
          {formattedTime && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Call Time</div>
              <div className="text-gray-900 font-semibold">{formattedTime}</div>
            </div>
          )}
          {content.location && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Location</div>
              <div className="text-[#D73F09] font-semibold">{content.location}</div>
            </div>
          )}
        </div>
      )}

      {/* Contacts */}
      {hasContacts && (
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Contacts</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {contacts.map((c) => (
              <div key={c.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="font-semibold text-gray-900">{c.name}</div>
                <div className="text-sm text-gray-500">{c.role || 'Postgame'}</div>
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="text-sm font-medium mt-1 block text-[#D73F09] hover:underline">
                    {c.phone}
                  </a>
                )}
              </div>
            ))}
            {content.videographer && (
              <div className="bg-white rounded-xl p-4 shadow-sm border-2" style={{ borderColor: color }}>
                <div className="font-semibold text-gray-900">{content.videographer.name}</div>
                <div className="text-sm text-gray-500">{content.videographer.role || 'Videographer'}</div>
                {content.videographer.phone && (
                  <a href={`tel:${content.videographer.phone}`} className="text-sm font-medium mt-1 block text-[#D73F09] hover:underline">
                    {content.videographer.phone}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConceptSection({ content, color }: { content: ConceptSectionContent; color: string }) {
  return (
    <div>
      <RichContent html={content.description} />
      {content.callout && (
        <div className="mt-4 rounded-xl p-5 text-white" style={{ backgroundColor: color }}>
          <div className="font-bold text-sm uppercase tracking-wide mb-2 opacity-90">{content.callout.title}</div>
          <div className="text-sm leading-relaxed opacity-95">{content.callout.text}</div>
        </div>
      )}
    </div>
  );
}

function PhotosSection({ content }: { content: PhotosSectionContent }) {
  return (
    <div>
      <RichContent html={content.description} className="mb-4" />
      {content.images && content.images.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {content.images.map((img, i) => (
            <div key={i} className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.caption || `Reference ${i + 1}`} className="w-full h-48 object-cover" />
              {img.caption && (
                <p className="text-xs text-gray-500 p-2 text-center">{img.caption}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VideosSection({ content }: { content: VideosSectionContent }) {
  return (
    <div>
      <RichContent html={content.description} className="mb-4" />
      {content.videos && content.videos.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {content.videos.map((vid, i) => (
            <div key={i} className="border-2 border-dashed border-gray-300 rounded-xl p-4">
              <a href={vid.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm hover:underline break-all">
                {vid.caption || vid.url}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeliverablesSection({ content, color }: { content: DeliverablesSectionContent; color: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {content.video && (
        <div className="bg-gray-50 rounded-xl p-5">
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color }}>VIDEO</div>
          <div className="font-semibold text-gray-900">{content.video.title}</div>
          {content.video.count && <div className="text-sm text-gray-500 mt-1">{content.video.count}</div>}
          <p className="text-sm text-gray-600 mt-2">{content.video.description}</p>
          {content.video.orientation && (
            <div className="text-xs text-gray-500 mt-2">{content.video.orientation}</div>
          )}
        </div>
      )}
      {content.photography && (
        <div className="bg-gray-50 rounded-xl p-5">
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color }}>PHOTOGRAPHY</div>
          <div className="font-semibold text-gray-900">{content.photography.title}</div>
          {content.photography.minimum && <div className="text-sm text-gray-500 mt-1">{content.photography.minimum}</div>}
          {content.photography.style && <p className="text-sm text-gray-600 mt-2">{content.photography.style}</p>}
        </div>
      )}
    </div>
  );
}

function ProductReqsSection({ content }: { content: ProductReqsSectionContent }) {
  return (
    <div className="space-y-4">
      {(content.items || []).map((item, i) => (
        <div key={i} className="bg-gray-50 rounded-xl p-4">
          <div className="font-semibold text-gray-900 mb-2">{item.name}</div>
          <ul className="space-y-1">
            {(item.requirements || []).map((req, j) => (
              <li key={j} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">&times;</span>
                {req}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function AthleteReqsSection({ content }: { content: AthleteReqsSectionContent }) {
  return (
    <div>
      <ul className="space-y-2 mb-4">
        {(content.requirements || []).map((req, i) => (
          <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
            <span className="text-gray-400 mt-0.5">&times;</span>
            {req}
          </li>
        ))}
      </ul>
      {content.tip && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="font-semibold text-amber-700 text-sm">{content.tip.title}</div>
          <div className="text-amber-600 text-sm mt-1">{content.tip.text}</div>
        </div>
      )}
    </div>
  );
}

function CreativeDirectionSection({ content, color }: { content: CreativeDirectionSectionContent; color: string }) {
  return (
    <div>
      {content.tone && content.tone.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {content.tone.map((t, i) => (
            <span key={i} className="px-3 py-1 rounded-full text-sm font-medium text-white" style={{ backgroundColor: color }}>
              {t}
            </span>
          ))}
        </div>
      )}
      {content.visual_style && <RichContent html={content.visual_style} className="mb-3" />}
      {content.lighting_notes && (
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Lighting Notes</div>
          <RichContent html={content.lighting_notes} className="text-sm" />
        </div>
      )}
    </div>
  );
}

function CameraSpecsSection({ content, color }: { content: CameraSpecsSectionContent; color: string }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-xl p-5">
          <div className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color }}>VIDEO SETTINGS</div>
          <div className="space-y-3">
            {Object.entries(content.video_settings || {}).map(([k, v]) => (
              <div key={k}>
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">{k.replace(/_/g, ' ')}</div>
                <div className="text-sm text-gray-900 font-medium leading-snug">{v}</div>
              </div>
            ))}
          </div>
        </div>
        {content.photography_settings && (
          <div className="bg-gray-50 rounded-xl p-5">
            <div className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color }}>PHOTO SETTINGS</div>
            <div className="space-y-3">
              {Object.entries(content.photography_settings || {}).map(([k, v]) => (
                <div key={k}>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">{k.replace(/_/g, ' ')}</div>
                  <div className="text-sm text-gray-900 font-medium leading-snug">{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {content.lens_recommendation && (
        <div className="bg-gray-50 rounded-xl p-5">
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color }}>LENS RECOMMENDATION</div>
          <RichContent html={content.lens_recommendation} className="text-sm" />
        </div>
      )}
    </div>
  );
}

function WorkflowSection({ content, color }: { content: WorkflowSectionContent; color: string }) {
  return (
    <div className="space-y-3">
      {(content.steps || []).map((step) => (
        <div key={step.number} className="flex gap-4">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ backgroundColor: color }}
          >
            {step.number}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-gray-900">{step.title}</div>
            <RichContent html={step.description} className="text-sm mt-0.5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DosDontsSection({ content }: { content: DosDontsSectionContent }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div>
        <div className="text-green-600 font-semibold text-sm mb-3">Do&apos;s</div>
        <ul className="space-y-2">
          {(content.dos || []).map((d, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="text-green-500 mt-0.5">✓</span>
              {d}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="text-red-600 font-semibold text-sm mb-3">Don&apos;ts</div>
        <ul className="space-y-2">
          {(content.donts || []).map((d, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="text-red-500 mt-0.5">✗</span>
              {d}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FileDeliverySection({ content, color }: { content: FileDeliverySectionContent; color: string }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-xl p-5">
          <div className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color }}>VIDEO SPECS</div>
          <div className="space-y-3">
            {Object.entries(content.video_specs || {}).map(([k, v]) => (
              <div key={k}>
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">{k.replace(/_/g, ' ')}</div>
                <div className="text-sm text-gray-900 font-medium leading-snug">{v}</div>
              </div>
            ))}
          </div>
        </div>
        {content.photo_specs && (
          <div className="bg-gray-50 rounded-xl p-5">
            <div className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color }}>PHOTO SPECS</div>
            <div className="space-y-3">
              {Object.entries(content.photo_specs || {}).map(([k, v]) => (
                <div key={k}>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">{k.replace(/_/g, ' ')}</div>
                  <div className="text-sm text-gray-900 font-medium leading-snug">{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {(content.delivery_method || content.deadline) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {content.delivery_method && (
            <div className="bg-gray-50 rounded-xl p-5">
              <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color }}>DELIVERY METHOD</div>
              <RichContent html={content.delivery_method} className="text-sm" />
            </div>
          )}
          {content.deadline && (
            <div className="bg-gray-50 rounded-xl p-5">
              <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color }}>DEADLINE</div>
              <p className="text-gray-900 text-sm font-medium">{content.deadline}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Legacy shoot details renderer ----
// Existing briefs store shoot details as a "concept" section with
// plain text description + callout. This renders them as structured cards.
function LegacyShootDetailsSection({ content, color }: { content: ConceptSectionContent; color: string }) {
  // Parse the plain-text description into labeled fields
  // Format is usually: "Videographer: X. Athlete: Y. Mom (talent): Z. Shoot date TBD."
  const description = content.description || '';
  const lines = description.split(/\.\s*/).filter(Boolean);

  // Parse key-value pairs from the description
  const fields: { label: string; value: string }[] = [];
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && colonIdx < 30) {
      fields.push({
        label: line.slice(0, colonIdx).trim(),
        value: line.slice(colonIdx + 1).trim(),
      });
    } else if (line.trim()) {
      fields.push({ label: 'Note', value: line.trim() });
    }
  }

  return (
    <div>
      {/* Parsed fields as a clean grid */}
      {fields.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {fields.map((f, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{f.label}</div>
              <div className="text-gray-900 font-medium">{f.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Callout (logistics / day-of info) */}
      {content.callout && (
        <div className="rounded-xl p-5 text-white" style={{ backgroundColor: color }}>
          <div className="font-bold text-sm mb-2 uppercase tracking-wide opacity-90">
            {content.callout.title}
          </div>
          <div className="text-sm leading-relaxed opacity-95">{content.callout.text}</div>
        </div>
      )}
    </div>
  );
}

// ---- Route a section to its renderer ----
function SectionRenderer({ section, color }: { section: CreatorBriefSection; color: string }) {
  // Detect legacy shoot details: type=concept but title contains "Shoot"
  const isLegacyShootDetails =
    section.type === 'concept' &&
    (section.title.toLowerCase().includes('shoot') || section.number === '00');

  if (isLegacyShootDetails) {
    return <LegacyShootDetailsSection content={section.content as ConceptSectionContent} color={color} />;
  }

  switch (section.type) {
    case 'shoot_logistics':
      return <ShootLogisticsSection content={section.content as ShootLogisticsContent} color={color} />;
    case 'concept':
      return <ConceptSection content={section.content as ConceptSectionContent} color={color} />;
    case 'photos':
      return <PhotosSection content={section.content as PhotosSectionContent} />;
    case 'videos':
      return <VideosSection content={section.content as VideosSectionContent} />;
    case 'deliverables':
      return <DeliverablesSection content={section.content as DeliverablesSectionContent} color={color} />;
    case 'product_reqs':
      return <ProductReqsSection content={section.content as ProductReqsSectionContent} />;
    case 'athlete_reqs':
      return <AthleteReqsSection content={section.content as AthleteReqsSectionContent} />;
    case 'creative_direction':
      return <CreativeDirectionSection content={section.content as CreativeDirectionSectionContent} color={color} />;
    case 'camera_specs':
      return <CameraSpecsSection content={section.content as CameraSpecsSectionContent} color={color} />;
    case 'workflow':
      return <WorkflowSection content={section.content as WorkflowSectionContent} color={color} />;
    case 'dos_donts':
      return <DosDontsSection content={section.content as DosDontsSectionContent} />;
    case 'file_delivery':
      return <FileDeliverySection content={section.content as FileDeliverySectionContent} color={color} />;
    default:
      return <pre className="text-xs text-gray-500">{JSON.stringify(section.content, null, 2)}</pre>;
  }
}

// ---- Main Page ----
export default function PublicCreatorBriefPage({ params }: { params: { slug: string } }) {
  const [brief, setBrief] = useState<CreatorBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // --- Upload state ---
  const [uploadDragActive, setUploadDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ name: string; status: 'uploading' | 'done' | 'error'; error?: string }[]>([]);
  const [uploadComplete, setUploadComplete] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/creator-briefs/public/${params.slug}`);
      if (res.ok) {
        setBrief(await res.json());
      } else {
        setNotFound(true);
      }
      setLoading(false);
    }
    load();
  }, [params.slug]);

  // --- Upload helpers ---

  // Recursively read all files from a dropped folder entry.
  // "entry" is a FileSystemEntry — a browser API object that
  // represents a file or folder from a drag-and-drop event.
  const readEntryFiles = (entry: FileSystemEntry): Promise<File[]> => {
    return new Promise((resolve) => {
      if (entry.isFile) {
        (entry as FileSystemFileEntry).file((f) => resolve([f]), () => resolve([]));
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        const allFiles: File[] = [];
        const readBatch = () => {
          reader.readEntries(async (entries) => {
            if (entries.length === 0) {
              resolve(allFiles);
              return;
            }
            for (const child of entries) {
              const childFiles = await readEntryFiles(child);
              allFiles.push(...childFiles);
            }
            readBatch(); // Keep reading until empty (batched API)
          }, () => resolve(allFiles));
        };
        readBatch();
      } else {
        resolve([]);
      }
    });
  };

  // Upload a single file using the two-step signed URL flow:
  //   Step 1: Ask our API for a signed upload URL (small JSON request)
  //   Step 2: PUT the file directly to Supabase Storage (no size limit)
  //   Step 3: Tell our API the upload is done (creates DB record + tags)
  const uploadSingleFile = useCallback(async (
    file: File,
    displayName: string,
    athleteName?: string,
  ): Promise<boolean> => {
    try {
      // Step 1 — get signed URL
      const step1 = await fetch('/api/creator-briefs/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: params.slug,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
        }),
      });

      if (!step1.ok) {
        const err = await step1.json();
        throw new Error(err.error || 'Failed to get upload URL');
      }

      const { signedUrl, token, storagePath } = await step1.json();

      // Step 2 — upload file directly to Supabase Storage
      // This bypasses Vercel entirely — the file goes straight
      // from the browser to Supabase's servers, so there's no
      // size limit from our serverless function.
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
          ...(token ? { 'x-upsert': 'false' } : {}),
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(`Storage upload failed: ${uploadRes.status}`);
      }

      // Step 3 — register the file in the database
      const step3 = await fetch('/api/creator-briefs/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: params.slug,
          storagePath,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          athleteName: athleteName || undefined,
        }),
      });

      if (!step3.ok) {
        const err = await step3.json();
        throw new Error(err.error || 'Failed to register upload');
      }

      // Mark this file as done in the progress list
      setUploadProgress((prev) =>
        prev.map((item) =>
          item.name === displayName && item.status === 'uploading'
            ? { ...item, status: 'done' as const }
            : item
        )
      );
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setUploadProgress((prev) =>
        prev.map((item) =>
          item.name === displayName && item.status === 'uploading'
            ? { ...item, status: 'error' as const, error: message }
            : item
        )
      );
      return false;
    }
  }, [params.slug]);

  // Main handler: uploads a list of files (with optional athlete name)
  const handleUploadFiles = useCallback(async (
    files: File[],
    athleteName?: string,
    displayPrefix?: string,
  ) => {
    if (!brief || files.length === 0) return;
    setUploading(true);
    setUploadComplete(false);

    // Build progress list
    const progressItems = files.map((f) => ({
      name: displayPrefix ? `${displayPrefix}/${f.name}` : f.name,
      status: 'uploading' as const,
    }));
    setUploadProgress((prev) => [...prev, ...progressItems]);

    // Upload files concurrently in batches of 3
    let successCount = 0;
    for (let i = 0; i < files.length; i += 3) {
      const batch = files.slice(i, i + 3);
      const results = await Promise.all(
        batch.map((file) => {
          const display = displayPrefix ? `${displayPrefix}/${file.name}` : file.name;
          return uploadSingleFile(file, display, athleteName);
        })
      );
      successCount += results.filter(Boolean).length;
    }

    if (successCount > 0) setUploadComplete(true);
    setUploading(false);
  }, [brief, uploadSingleFile]);

  // Handler for folder drops — groups files by folder (athlete) name
  const handleFolderDrop = useCallback(async (items: DataTransferItemList) => {
    if (!brief) return;
    setUploading(true);
    setUploadComplete(false);
    setUploadProgress([]);

    // IMPORTANT: Grab all entries SYNCHRONOUSLY first!
    // The browser invalidates the DataTransferItemList after any
    // async operation, so if we await inside the loop, items 2-22
    // would silently disappear. We snapshot everything up front,
    // then process them asynchronously after.
    const entries: FileSystemEntry[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) entries.push(entry);
    }

    // Now process all entries asynchronously
    const folderFiles: { folderName: string; files: File[] }[] = [];
    const looseFiles: File[] = [];

    for (const entry of entries) {
      if (entry.isDirectory) {
        const files = await readEntryFiles(entry);
        const mediaFiles = files.filter(
          (f) => f.type.startsWith('image/') || f.type.startsWith('video/')
        );
        if (mediaFiles.length > 0) {
          folderFiles.push({ folderName: entry.name, files: mediaFiles });
        }
      } else if (entry.isFile) {
        const file = await new Promise<File | null>((resolve) => {
          (entry as FileSystemFileEntry).file((f) => resolve(f), () => resolve(null));
        });
        if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
          looseFiles.push(file);
        }
      }
    }

    // Build progress list for all files at once
    const allProgress: { name: string; status: 'uploading' | 'done' | 'error'; error?: string }[] = [];
    for (const folder of folderFiles) {
      for (const file of folder.files) {
        allProgress.push({ name: `${folder.folderName}/${file.name}`, status: 'uploading' });
      }
    }
    for (const file of looseFiles) {
      allProgress.push({ name: file.name, status: 'uploading' });
    }
    setUploadProgress(allProgress);

    let totalSuccess = 0;

    // Upload folder files with athlete name = folder name
    for (const folder of folderFiles) {
      let folderSuccess = 0;
      for (let i = 0; i < folder.files.length; i += 3) {
        const batch = folder.files.slice(i, i + 3);
        const results = await Promise.all(
          batch.map((file) =>
            uploadSingleFile(file, `${folder.folderName}/${file.name}`, folder.folderName)
          )
        );
        folderSuccess += results.filter(Boolean).length;
      }
      totalSuccess += folderSuccess;

      // Notify the campaign manager that this athlete's footage is in
      if (folderSuccess > 0) {
        fetch('/api/creator-briefs/upload/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: params.slug,
            athleteName: folder.folderName,
            fileCount: folderSuccess,
            fileNames: folder.files.map((f) => f.name),
          }),
        }).catch(() => {}); // Fire and forget — don't block the UI
      }
    }

    // Upload loose files (no athlete name override)
    if (looseFiles.length > 0) {
      for (let i = 0; i < looseFiles.length; i += 3) {
        const batch = looseFiles.slice(i, i + 3);
        const results = await Promise.all(
          batch.map((file) => uploadSingleFile(file, file.name))
        );
        totalSuccess += results.filter(Boolean).length;
      }
    }

    if (totalSuccess > 0) setUploadComplete(true);
    setUploading(false);
  }, [brief, uploadSingleFile]);

  const handleUploadDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setUploadDragActive(true);
    } else if (e.type === 'dragleave') {
      setUploadDragActive(false);
    }
  }, []);

  const handleUploadDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setUploadDragActive(false);

    // Check if any dropped items are folders
    const items = e.dataTransfer.items;
    let hasFolder = false;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          hasFolder = true;
          break;
        }
      }
    }

    if (hasFolder) {
      // Use the folder-aware handler
      handleFolderDrop(items);
    } else if (e.dataTransfer.files?.length > 0) {
      // Plain file drop — reset progress and upload
      setUploadProgress([]);
      handleUploadFiles(Array.from(e.dataTransfer.files));
    }
  }, [handleFolderDrop, handleUploadFiles]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !brief) {
    return (
      <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center">
        <p className="text-gray-500 text-lg">Brief not found or not yet published.</p>
      </div>
    );
  }

  // Always Postgame orange — no brand colors
  const color = '#D73F09';

  // Separate shoot logistics from content sections.
  // Handle both new format (type=shoot_logistics) and legacy (type=concept with "Shoot" in title or number=00)
  const isShootSection = (s: CreatorBriefSection) =>
    s.type === 'shoot_logistics' ||
    (s.type === 'concept' && (s.title.toLowerCase().includes('shoot') || s.number === '00'));

  const rawShootSection = brief.sections.find(isShootSection);
  const contentSections = brief.sections.filter((s) => !isShootSection(s));

  // The editor saves contacts/schedule as top-level brief columns,
  // but the ShootLogisticsSection renderer reads from section.content.
  // Merge them so the public page always shows the latest data.
  // Build merged shoot logistics content from brief-level fields
  const mergedShootContent: ShootLogisticsContent = {
    shoot_date: brief.shoot_date || (rawShootSection?.content as ShootLogisticsContent)?.shoot_date || null,
    shoot_time: brief.shoot_time || (rawShootSection?.content as ShootLogisticsContent)?.shoot_time || null,
    location: brief.location || (rawShootSection?.content as ShootLogisticsContent)?.location || null,
    postgame_contacts: brief.postgame_contacts?.length
      ? brief.postgame_contacts
      : (rawShootSection?.content as ShootLogisticsContent)?.postgame_contacts || [],
    videographer: brief.videographer ?? (rawShootSection?.content as ShootLogisticsContent)?.videographer ?? null,
  };

  // If we have a real shoot section, merge our data into it.
  // If not, but we have contacts/schedule, create a synthetic one.
  const hasShootData = mergedShootContent.shoot_date || mergedShootContent.shoot_time
    || mergedShootContent.location || mergedShootContent.postgame_contacts.length > 0
    || mergedShootContent.videographer;

  // Always force the type to 'shoot_logistics' so the SectionRenderer
  // uses the structured renderer (not the legacy plain-text one).
  // Many briefs were created with type='concept' for section 00,
  // but the editor now saves contacts/schedule as top-level brief columns.
  const shootSection = rawShootSection
    ? { ...rawShootSection, type: 'shoot_logistics' as const, content: mergedShootContent }
    : hasShootData
      ? { number: '00', title: 'Shoot Details', type: 'shoot_logistics' as const, content: mergedShootContent }
      : null;

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      {/* Hero — pt-20 accounts for the fixed Postgame navbar */}
      <div className="bg-white border-b border-gray-200 pt-20">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/postgame-logo-black.png" alt="Postgame" className="h-7 object-contain" />
            {brief.brand_logo_url && (
              <>
                <span className="text-gray-300 text-sm">×</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={brief.brand_logo_url} alt="Brand" className="h-8 object-contain" />
              </>
            )}
          </div>

          <span
            className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full text-white mb-4"
            style={{ backgroundColor: color }}
          >
            Videographer Creative Brief
          </span>

          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
            {brief.title}
          </h1>

          {brief.athlete_name && (
            <p className="text-gray-500 text-lg mt-2">Athlete: {brief.athlete_name}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Shoot Details / Logistics — rendered as a special top card */}
        {shootSection && (
          <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: color }}
              >
                {shootSection.number}
              </span>
              <h2 className="text-2xl font-bold text-gray-900">{shootSection.title}</h2>
            </div>
            <hr className="mb-4" style={{ borderColor: color, opacity: 0.3 }} />
            <SectionRenderer section={shootSection} color={color} />

            {/* Athlete inside shoot details */}
            {brief.athlete_profile && (brief.athlete_profile.name || brief.athlete_profile.photo_url) && (
              <div className="mt-6 border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-[#D73F09]/5 px-5 py-3 border-b border-gray-200">
                  <div className="text-[10px] font-bold text-[#D73F09] uppercase tracking-widest">Athlete</div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-5">
                    {brief.athlete_profile.photo_url && (
                      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 border-[#D73F09]/20">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={brief.athlete_profile.photo_url} alt={brief.athlete_profile.name || 'Athlete'} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1">
                      {brief.athlete_profile.name && (
                        <div className="text-lg font-bold text-gray-900">{brief.athlete_profile.name}</div>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[15px] text-gray-500 mt-0.5">
                        {brief.athlete_profile.sport && <span>{brief.athlete_profile.sport}</span>}
                        {brief.athlete_profile.school && <span>· {brief.athlete_profile.school}</span>}
                        {brief.athlete_profile.year && <span>· {brief.athlete_profile.year}</span>}
                      </div>
                      {brief.athlete_profile.instagram && (
                        <a href={`https://instagram.com/${brief.athlete_profile.instagram}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#D73F09] hover:underline mt-1">
                          <InstagramIcon className="w-3.5 h-3.5" />
                          @{brief.athlete_profile.instagram}
                        </a>
                      )}
                      {brief.athlete_profile.bio && (
                        <p className="text-gray-500 text-[15px] mt-1.5 leading-relaxed">{brief.athlete_profile.bio}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Numbered sections */}
        <div className="space-y-8">
          {contentSections.map((section) => (
            <div key={`${section.type}-${section.number}`} className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: color }}
                >
                  {section.number}
                </span>
                <h2 className="text-2xl font-bold text-gray-900">{section.title}</h2>
              </div>
              <hr className="mb-4" style={{ borderColor: color, opacity: 0.3 }} />
              <SectionRenderer section={section} color={color} />
            </div>
          ))}
        </div>

        {/* ---- Upload Zone ---- */}
        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 mt-8">
          <div className="flex items-center gap-3 mb-4">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: color }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </span>
            <h2 className="text-2xl font-bold text-gray-900">Upload Footage</h2>
          </div>
          <hr className="mb-4" style={{ borderColor: color, opacity: 0.3 }} />

          <p className="text-gray-500 text-[15px] mb-4">
            Drop your photos and videos here when you&apos;re done shooting. You can drag
            entire folders — the folder name will be used as the athlete name. Files are
            automatically tagged and organized — no login needed.
          </p>

          {/* Drop zone */}
          <div
            onDragEnter={handleUploadDrag}
            onDragLeave={handleUploadDrag}
            onDragOver={handleUploadDrag}
            onDrop={handleUploadDrop}
            onClick={() => uploadInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer
              transition-all duration-200
              ${uploadDragActive
                ? 'border-[#D73F09] bg-[#D73F09]/5'
                : 'border-gray-300 hover:border-gray-400 bg-gray-50/50'
              }
              ${uploading ? 'pointer-events-none opacity-60' : ''}
            `}
          >
            <input
              ref={uploadInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) {
                  setUploadProgress([]);
                  handleUploadFiles(Array.from(e.target.files));
                  e.target.value = '';
                }
              }}
            />

            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-gray-300 border-t-[#D73F09] rounded-full animate-spin" />
                <p className="text-gray-600 font-medium">Uploading...</p>
              </div>
            ) : uploadComplete ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-gray-900 font-semibold">Upload complete!</p>
                <p className="text-gray-500 text-sm">Files are being tagged automatically. Drop more to continue.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-900 font-semibold">Drag &amp; drop files or folders here</p>
                  <p className="text-gray-500 text-sm mt-1">or click to browse — drop athlete folders to auto-tag by name</p>
                </div>
              </div>
            )}
          </div>

          {/* File progress list */}
          {uploadProgress.length > 0 && (
            <div className="mt-4 space-y-2">
              {uploadProgress.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 rounded-lg text-sm"
                >
                  {file.status === 'uploading' && (
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-[#D73F09] rounded-full animate-spin flex-shrink-0" />
                  )}
                  {file.status === 'done' && (
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {file.status === 'error' && (
                    <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  )}
                  <span className="text-gray-700 truncate flex-1">{file.name}</span>
                  {file.status === 'done' && (
                    <span className="text-green-600 text-xs font-medium">Done</span>
                  )}
                  {file.status === 'error' && (
                    <span className="text-red-500 text-xs">{file.error || 'Failed'}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center mt-12 pb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/postgame-logo-black.png" alt="Postgame" className="h-5 object-contain opacity-40 mb-2" />
          <div className="text-gray-400 text-xs">{brief.title} — Confidential</div>
        </div>
      </div>
    </div>
  );
}
