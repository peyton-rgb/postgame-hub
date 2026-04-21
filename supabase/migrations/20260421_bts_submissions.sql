-- BTS submissions table: stores athlete BTS video uploads
CREATE TABLE public.bts_submissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_name text NOT NULL,
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.campaign_recaps(id) ON DELETE SET NULL,
  hold_posting boolean NOT NULL DEFAULT false,
  video_url text NOT NULL,
  video_path text NOT NULL,
  file_size_bytes bigint,
  file_mime_type text,
  original_filename text,
  submitter_name text,
  sheet_synced_at timestamptz,
  sheet_sync_error text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bts_submissions_brand_id_idx ON public.bts_submissions (brand_id);
CREATE INDEX bts_submissions_campaign_id_idx ON public.bts_submissions (campaign_id);
CREATE INDEX bts_submissions_submitted_at_idx ON public.bts_submissions (submitted_at DESC);
CREATE INDEX bts_submissions_hold_posting_idx ON public.bts_submissions (hold_posting);

CREATE TRIGGER bts_submissions_set_updated_at
  BEFORE UPDATE ON public.bts_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.bts_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can insert submissions"
  ON public.bts_submissions
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "authenticated users can read all"
  ON public.bts_submissions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can update all"
  ON public.bts_submissions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated users can delete"
  ON public.bts_submissions
  FOR DELETE
  TO authenticated
  USING (true);
