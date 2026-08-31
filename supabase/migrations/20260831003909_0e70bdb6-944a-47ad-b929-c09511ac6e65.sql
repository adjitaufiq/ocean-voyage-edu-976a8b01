ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS visitor_id text,
  ADD COLUMN IF NOT EXISTS first_touch_channel text,
  ADD COLUMN IF NOT EXISTS first_touch_source text,
  ADD COLUMN IF NOT EXISTS first_touch_landing_page text,
  ADD COLUMN IF NOT EXISTS first_touch_referrer text,
  ADD COLUMN IF NOT EXISTS first_touch_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_touch_channel text,
  ADD COLUMN IF NOT EXISTS last_touch_source text,
  ADD COLUMN IF NOT EXISTS last_touch_page text,
  ADD COLUMN IF NOT EXISTS first_content_path text,
  ADD COLUMN IF NOT EXISTS first_content_title text,
  ADD COLUMN IF NOT EXISTS conversion_surface text;

CREATE TABLE IF NOT EXISTS public.acquisition_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  visitor_id text NOT NULL,
  session_id text,
  event text NOT NULL,
  path text,
  label text,
  channel text,
  source text,
  campaign text,
  landing_page text,
  device_type text
);

GRANT SELECT ON public.acquisition_events TO authenticated;
GRANT ALL ON public.acquisition_events TO service_role;

ALTER TABLE public.acquisition_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acquisition_events_read_team" ON public.acquisition_events;
CREATE POLICY "acquisition_events_read_team"
  ON public.acquisition_events FOR SELECT TO authenticated
  USING (public.can_work_leads(auth.uid()) OR public.can_manage_business(auth.uid()));

CREATE INDEX IF NOT EXISTS acquisition_events_created_idx ON public.acquisition_events (created_at DESC);
CREATE INDEX IF NOT EXISTS acquisition_events_event_idx ON public.acquisition_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS acquisition_events_visitor_idx ON public.acquisition_events (visitor_id);