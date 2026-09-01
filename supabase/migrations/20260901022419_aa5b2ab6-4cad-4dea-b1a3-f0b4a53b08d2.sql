-- Outbound prospecting layer (additive; separate from public.consultations CRM)

CREATE TABLE IF NOT EXISTS public.prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  industry text,
  city text,
  country text NOT NULL DEFAULT 'ID',
  website text,
  website_domain text,
  contact_name text,
  contact_title text,
  contact_email text,
  contact_whatsapp text,
  source text NOT NULL DEFAULT 'manual',
  source_detail text,
  discovery_query text,
  research_summary text,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  pain_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  fit_score integer NOT NULL DEFAULT 0,
  fit_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  fit_tier text NOT NULL DEFAULT 'unscored',
  status text NOT NULL DEFAULT 'new',
  status_updated_at timestamptz NOT NULL DEFAULT now(),
  do_not_contact boolean NOT NULL DEFAULT false,
  do_not_contact_reason text,
  outreach_channel text,
  outreach_draft text,
  outreach_subject text,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  contacted_at timestamptz,
  replied_at timestamptz,
  follow_up_count integer NOT NULL DEFAULT 0,
  next_follow_up_at timestamptz,
  lead_id uuid REFERENCES public.consultations(id) ON DELETE SET NULL,
  converted_at timestamptz,
  owner_name text,
  notes text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospects TO authenticated;
GRANT ALL ON public.prospects TO service_role;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prospects_read_team" ON public.prospects;
CREATE POLICY "prospects_read_team" ON public.prospects FOR SELECT TO authenticated
  USING (public.has_workspace_access(auth.uid()));

DROP POLICY IF EXISTS "prospects_insert_sales" ON public.prospects;
CREATE POLICY "prospects_insert_sales" ON public.prospects FOR INSERT TO authenticated
  WITH CHECK (public.can_work_leads(auth.uid()));

DROP POLICY IF EXISTS "prospects_update_sales" ON public.prospects;
CREATE POLICY "prospects_update_sales" ON public.prospects FOR UPDATE TO authenticated
  USING (public.can_work_leads(auth.uid()))
  WITH CHECK (public.can_work_leads(auth.uid()));

DROP POLICY IF EXISTS "prospects_delete_manage" ON public.prospects;
CREATE POLICY "prospects_delete_manage" ON public.prospects FOR DELETE TO authenticated
  USING (public.can_manage_business(auth.uid()));

CREATE INDEX IF NOT EXISTS prospects_created_idx ON public.prospects (created_at DESC);
CREATE INDEX IF NOT EXISTS prospects_status_idx ON public.prospects (status, fit_score DESC);
CREATE INDEX IF NOT EXISTS prospects_follow_up_idx ON public.prospects (next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS prospects_domain_uniq ON public.prospects (lower(website_domain)) WHERE website_domain IS NOT NULL AND website_domain <> '';
CREATE UNIQUE INDEX IF NOT EXISTS prospects_email_uniq ON public.prospects (lower(contact_email)) WHERE contact_email IS NOT NULL AND contact_email <> '';
CREATE UNIQUE INDEX IF NOT EXISTS prospects_whatsapp_uniq ON public.prospects (contact_whatsapp) WHERE contact_whatsapp IS NOT NULL AND contact_whatsapp <> '';

DROP TRIGGER IF EXISTS prospects_updated_at ON public.prospects;
CREATE TRIGGER prospects_updated_at BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.set_proposals_updated_at();

CREATE TABLE IF NOT EXISTS public.prospect_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  action text NOT NULL,
  label text,
  content text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.prospect_activities TO authenticated;
GRANT ALL ON public.prospect_activities TO service_role;
ALTER TABLE public.prospect_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prospect_activities_read_team" ON public.prospect_activities;
CREATE POLICY "prospect_activities_read_team" ON public.prospect_activities FOR SELECT TO authenticated
  USING (public.has_workspace_access(auth.uid()));

DROP POLICY IF EXISTS "prospect_activities_insert_sales" ON public.prospect_activities;
CREATE POLICY "prospect_activities_insert_sales" ON public.prospect_activities FOR INSERT TO authenticated
  WITH CHECK (public.can_work_leads(auth.uid()));

CREATE INDEX IF NOT EXISTS prospect_activities_prospect_idx ON public.prospect_activities (prospect_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.prospect_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'discovery',
  trigger_source text NOT NULL DEFAULT 'manual',
  query text,
  status text NOT NULL DEFAULT 'running',
  found_count integer NOT NULL DEFAULT 0,
  saved_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  ai_calls integer NOT NULL DEFAULT 0,
  error text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.prospect_runs TO authenticated;
GRANT ALL ON public.prospect_runs TO service_role;
ALTER TABLE public.prospect_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prospect_runs_read_team" ON public.prospect_runs;
CREATE POLICY "prospect_runs_read_team" ON public.prospect_runs FOR SELECT TO authenticated
  USING (public.has_workspace_access(auth.uid()));

CREATE INDEX IF NOT EXISTS prospect_runs_created_idx ON public.prospect_runs (created_at DESC);

CREATE TABLE IF NOT EXISTS public.prospect_job_state (
  key text PRIMARY KEY,
  locked_at timestamptz,
  last_run_at timestamptz,
  last_status text,
  detail text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.prospect_job_state TO authenticated;
GRANT ALL ON public.prospect_job_state TO service_role;
ALTER TABLE public.prospect_job_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prospect_job_state_read_team" ON public.prospect_job_state;
CREATE POLICY "prospect_job_state_read_team" ON public.prospect_job_state FOR SELECT TO authenticated
  USING (public.has_workspace_access(auth.uid()));

CREATE TABLE IF NOT EXISTS public.prospect_icp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.prospect_icp_config TO authenticated;
GRANT ALL ON public.prospect_icp_config TO service_role;
ALTER TABLE public.prospect_icp_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prospect_icp_read_team" ON public.prospect_icp_config;
CREATE POLICY "prospect_icp_read_team" ON public.prospect_icp_config FOR SELECT TO authenticated
  USING (public.has_workspace_access(auth.uid()));

DROP POLICY IF EXISTS "prospect_icp_insert_manage" ON public.prospect_icp_config;
CREATE POLICY "prospect_icp_insert_manage" ON public.prospect_icp_config FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_business(auth.uid()));

DROP POLICY IF EXISTS "prospect_icp_update_manage" ON public.prospect_icp_config;
CREATE POLICY "prospect_icp_update_manage" ON public.prospect_icp_config FOR UPDATE TO authenticated
  USING (public.can_manage_business(auth.uid()))
  WITH CHECK (public.can_manage_business(auth.uid()));

DROP TRIGGER IF EXISTS prospect_icp_config_updated_at ON public.prospect_icp_config;
CREATE TRIGGER prospect_icp_config_updated_at BEFORE UPDATE ON public.prospect_icp_config
  FOR EACH ROW EXECUTE FUNCTION public.set_proposals_updated_at();