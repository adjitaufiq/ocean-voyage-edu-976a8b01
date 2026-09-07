CREATE TABLE public.prospect_enrichments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_candidate_id uuid REFERENCES public.prospect_candidates(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'apify',
  actor_name text,
  run_id text,
  dataset_id text,
  source_type text NOT NULL,
  source_url text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prospect_enrichments_status_check CHECK (status IN ('pending','completed','failed')),
  CONSTRAINT prospect_enrichments_source_type_check CHECK (source_type IN ('google_maps','website','instagram','linkedin','facebook','company_database')),
  CONSTRAINT prospect_enrichments_target_check CHECK (prospect_candidate_id IS NOT NULL OR prospect_id IS NOT NULL)
);

CREATE INDEX prospect_enrichments_candidate_idx ON public.prospect_enrichments (prospect_candidate_id, created_at DESC);
CREATE INDEX prospect_enrichments_prospect_idx ON public.prospect_enrichments (prospect_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.prospect_enrichments TO authenticated;
GRANT ALL ON public.prospect_enrichments TO service_role;
ALTER TABLE public.prospect_enrichments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace can read enrichments" ON public.prospect_enrichments
  FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid()));
CREATE POLICY "Sales can insert enrichments" ON public.prospect_enrichments
  FOR INSERT TO authenticated WITH CHECK (public.can_work_leads(auth.uid()));
CREATE POLICY "Sales can update enrichments" ON public.prospect_enrichments
  FOR UPDATE TO authenticated USING (public.can_work_leads(auth.uid())) WITH CHECK (public.can_work_leads(auth.uid()));

CREATE TRIGGER prospect_enrichments_updated_at
  BEFORE UPDATE ON public.prospect_enrichments
  FOR EACH ROW EXECUTE FUNCTION public.set_proposals_updated_at();

CREATE TABLE public.apify_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL,
  source_type text,
  candidate_id uuid REFERENCES public.prospect_candidates(id) ON DELETE SET NULL,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_id text,
  dataset_id text,
  status text NOT NULL DEFAULT 'running',
  duration_ms integer,
  item_count integer NOT NULL DEFAULT 0,
  error text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT apify_runs_status_check CHECK (status IN ('running','succeeded','failed','timeout'))
);

CREATE INDEX apify_runs_created_idx ON public.apify_runs (created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.apify_runs TO authenticated;
GRANT ALL ON public.apify_runs TO service_role;
ALTER TABLE public.apify_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace can read apify runs" ON public.apify_runs
  FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid()));
CREATE POLICY "Sales can insert apify runs" ON public.apify_runs
  FOR INSERT TO authenticated WITH CHECK (public.can_work_leads(auth.uid()));
CREATE POLICY "Sales can update apify runs" ON public.apify_runs
  FOR UPDATE TO authenticated USING (public.can_work_leads(auth.uid())) WITH CHECK (public.can_work_leads(auth.uid()));

CREATE TRIGGER apify_runs_updated_at
  BEFORE UPDATE ON public.apify_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_proposals_updated_at();

ALTER TABLE public.prospect_candidates DROP CONSTRAINT IF EXISTS prospect_candidates_candidate_status_check;
ALTER TABLE public.prospect_candidates ADD CONSTRAINT prospect_candidates_candidate_status_check
  CHECK (candidate_status IN ('discovered','enriching','verified','pending_review','approved','rejected','promoted','enrichment_failed'));