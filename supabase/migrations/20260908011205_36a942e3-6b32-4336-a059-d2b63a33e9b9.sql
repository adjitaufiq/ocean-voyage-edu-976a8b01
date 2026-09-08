-- 1. Campaign discovery settings
ALTER TABLE public.prospect_campaigns
  ADD COLUMN IF NOT EXISTS discovery_provider text NOT NULL DEFAULT 'google_maps',
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS radius_meters integer NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS target_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS target_candidates integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS areas jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Candidate factual + screening + QC columns
ALTER TABLE public.prospect_candidates
  ADD COLUMN IF NOT EXISTS place_id text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS website_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS rating numeric,
  ADD COLUMN IF NOT EXISTS review_count integer,
  ADD COLUMN IF NOT EXISTS google_maps_url text,
  ADD COLUMN IF NOT EXISTS opening_hours jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS permanently_closed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_keyword text,
  ADD COLUMN IF NOT EXISTS lead_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_temperature text NOT NULL DEFAULT 'cold',
  ADD COLUMN IF NOT EXISTS lead_reason text,
  ADD COLUMN IF NOT EXISTS digital_gap text,
  ADD COLUMN IF NOT EXISTS recommended_solution text,
  ADD COLUMN IF NOT EXISTS sales_priority text,
  ADD COLUMN IF NOT EXISTS qc_status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS qc_reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS qc_reviewed_by_email text,
  ADD COLUMN IF NOT EXISTS qc_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS qc_reason text,
  ADD COLUMN IF NOT EXISTS discovery_task_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS prospect_candidates_place_id_key
  ON public.prospect_candidates (place_id) WHERE place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS prospect_candidates_qc_status_idx
  ON public.prospect_candidates (qc_status);
CREATE INDEX IF NOT EXISTS prospect_candidates_lead_temperature_idx
  ON public.prospect_candidates (lead_temperature);

-- 3. Discovery tasks (keyword x area)
CREATE TABLE IF NOT EXISTS public.discovery_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.prospect_campaigns(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  area text NOT NULL,
  latitude numeric,
  longitude numeric,
  radius_meters integer NOT NULL DEFAULT 5000,
  status text NOT NULL DEFAULT 'queued',
  attempt integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  page_token text,
  found_count integer NOT NULL DEFAULT 0,
  saved_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  last_error text,
  locked_at timestamptz,
  last_run_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_tasks TO authenticated;
GRANT ALL ON public.discovery_tasks TO service_role;
ALTER TABLE public.discovery_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace can read discovery tasks" ON public.discovery_tasks
  FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid()));
CREATE POLICY "Sales can create discovery tasks" ON public.discovery_tasks
  FOR INSERT TO authenticated WITH CHECK (public.can_work_leads(auth.uid()));
CREATE POLICY "Sales can update discovery tasks" ON public.discovery_tasks
  FOR UPDATE TO authenticated USING (public.can_work_leads(auth.uid()))
  WITH CHECK (public.can_work_leads(auth.uid()));
CREATE POLICY "Admins can delete discovery tasks" ON public.discovery_tasks
  FOR DELETE TO authenticated USING (public.can_manage_business(auth.uid()));

CREATE INDEX IF NOT EXISTS discovery_tasks_status_idx ON public.discovery_tasks (status, created_at);
CREATE INDEX IF NOT EXISTS discovery_tasks_campaign_idx ON public.discovery_tasks (campaign_id);

CREATE TRIGGER discovery_tasks_updated_at BEFORE UPDATE ON public.discovery_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_proposals_updated_at();

-- 4. Candidate sources (per provider evidence)
CREATE TABLE IF NOT EXISTS public.candidate_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.prospect_candidates(id) ON DELETE CASCADE,
  provider text NOT NULL,
  source_type text NOT NULL,
  source_url text,
  external_id text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.candidate_sources TO authenticated;
GRANT ALL ON public.candidate_sources TO service_role;
ALTER TABLE public.candidate_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace can read candidate sources" ON public.candidate_sources
  FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid()));
CREATE POLICY "Sales can write candidate sources" ON public.candidate_sources
  FOR INSERT TO authenticated WITH CHECK (public.can_work_leads(auth.uid()));

CREATE INDEX IF NOT EXISTS candidate_sources_candidate_idx ON public.candidate_sources (candidate_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS candidate_sources_unique_evidence
  ON public.candidate_sources (candidate_id, provider, source_type, coalesce(external_id, ''));

-- 5. Candidate status history
CREATE TABLE IF NOT EXISTS public.candidate_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.prospect_candidates(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  reason text,
  actor_kind text NOT NULL DEFAULT 'system',
  actor_label text,
  actor_id uuid REFERENCES auth.users(id),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.candidate_status_history TO authenticated;
GRANT ALL ON public.candidate_status_history TO service_role;
ALTER TABLE public.candidate_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace can read candidate status history" ON public.candidate_status_history
  FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid()));
CREATE POLICY "Sales can write candidate status history" ON public.candidate_status_history
  FOR INSERT TO authenticated WITH CHECK (public.can_work_leads(auth.uid()));

CREATE INDEX IF NOT EXISTS candidate_status_history_candidate_idx
  ON public.candidate_status_history (candidate_id, created_at DESC);

-- 6. Provider usage counter
CREATE TABLE IF NOT EXISTS public.discovery_usage_daily (
  usage_date date NOT NULL,
  provider text NOT NULL,
  requests integer NOT NULL DEFAULT 0,
  results integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usage_date, provider)
);

GRANT SELECT ON public.discovery_usage_daily TO authenticated;
GRANT ALL ON public.discovery_usage_daily TO service_role;
ALTER TABLE public.discovery_usage_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace can read discovery usage" ON public.discovery_usage_daily
  FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid()));