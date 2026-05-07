// ============================================================
// /api/editing/jobs
//
// GET  — list edit jobs, optional ?status= and ?limit=&offset=.
//        Returns { jobs, total }.
// POST — create a new edit job in 'pending' status.
//        Pipeline kickoff is deferred until the agents/orchestrator
//        land; this route just persists the row.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createServiceSupabase } from '@/lib/supabase';
import type { EditJob, EditJobStatus, ContentType } from '@/lib/types/editing';

export const runtime = 'nodejs';

const VALID_STATUSES: EditJobStatus[] = [
  'pending', 'analyzing', 'planning', 'confirming',
  'editing', 'review', 'approved', 'rejected', 'failed',
];

const VALID_CONTENT_TYPES: ContentType[] = ['video', 'image'];

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseInt32(value: string | null, fallback: number, max?: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return max != null ? Math.min(n, max) : n;
}

export async function GET(request: NextRequest) {
  const auth = await createServerSupabase();
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const limit = parseInt32(searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT);
  const offset = parseInt32(searchParams.get('offset'), 0);

  const db = createServiceSupabase();
  let query = db
    .from('edit_jobs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + Math.max(limit - 1, 0));

  if (status) {
    if (!VALID_STATUSES.includes(status as EditJobStatus)) {
      return NextResponse.json(
        { error: `Invalid status filter: ${status}` },
        { status: 400 }
      );
    }
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;
  if (error) {
    console.error('edit_jobs list failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    jobs: (data as EditJob[]) || [],
    total: count ?? 0,
  });
}

interface CreateBody {
  asset_id?: string | null;
  source_url?: string;
  content_type?: ContentType;
  instruction?: string;
  reference_image_url?: string | null;
}

export async function POST(request: NextRequest) {
  const auth = await createServerSupabase();
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { asset_id, source_url, content_type, instruction, reference_image_url } = body;

  if (!source_url || !instruction || !content_type) {
    return NextResponse.json(
      { error: 'source_url, content_type, and instruction are required' },
      { status: 400 }
    );
  }
  if (!VALID_CONTENT_TYPES.includes(content_type)) {
    return NextResponse.json(
      { error: `content_type must be one of: ${VALID_CONTENT_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  const db = createServiceSupabase();
  const { data, error } = await db
    .from('edit_jobs')
    .insert({
      asset_id: asset_id ?? null,
      source_url,
      content_type,
      instruction,
      reference_image_url: reference_image_url ?? null,
      status: 'pending' as EditJobStatus,
      created_by: user.id,
    })
    .select('*')
    .single();

  if (error || !data) {
    console.error('edit_jobs create failed:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create job' },
      { status: 500 }
    );
  }

  return NextResponse.json(data as EditJob, { status: 201 });
}
