CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.normalize_business_name(_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    btrim(
      regexp_replace(
        regexp_replace(
          lower(coalesce(_raw, '')),
          '\m(pt|cv|ud|pd|tbk|persero|inc|llc|ltd|co|corp|company|indonesia)\M',
          ' ',
          'g'
        ),
        '[^a-z0-9]+',
        ' ',
        'g'
      )
    ),
    ''
  )
$$;

CREATE TABLE public.prospect_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.prospect_campaigns(id) ON DELETE SET NULL,
  business_name text NOT NULL,
  business_name_normalized text,
  industry text,
  city text,
  country text NOT NULL DEFAULT 'Indonesia',
  why_match_icp text,
  potential_problem_hypothesis text,
  buying_signal_hypothesis text,
  suggested_solution text,
  discovery_reason text,
  discovery_method text NOT NULL DEFAULT 'ai_discovery',
  discovery_query text,
  discovery_source text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  candidate_status text NOT NULL DEFAULT 'discovered',
  duplicate_status text NOT NULL DEFAULT 'unchecked',
  duplicate_of uuid REFERENCES public.prospect_candidates(id) ON DELETE SET NULL,
  icp_score integer NOT NULL DEFAULT 0,
  trust_score integer NOT NULL DEFAULT 0,
  trust_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  rejected_reason text,
  promoted_prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prospect_candidates_status_check CHECK (candidate_status IN ('discovered','enriching','verified','rejected','promoted')),
  CONSTRAINT prospect_candidates_duplicate_check CHECK (duplicate_status IN ('unchecked','unique','suspected','duplicate')),
  CONSTRAINT prospect_candidates_method_check CHECK (discovery_method IN ('ai_discovery','manual','import','apify_search'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_candidates TO authenticated;
GRANT ALL ON public.prospect_candidates TO service_role;

ALTER TABLE public.prospect_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace can read candidates"
  ON public.prospect_candidates FOR SELECT TO authenticated
  USING (public.has_workspace_access(auth.uid()));

CREATE POLICY "Sales can insert candidates"
  ON public.prospect_candidates FOR INSERT TO authenticated
  WITH CHECK (public.can_work_leads(auth.uid()));

CREATE POLICY "Sales can update candidates"
  ON public.prospect_candidates FOR UPDATE TO authenticated
  USING (public.can_work_leads(auth.uid()))
  WITH CHECK (public.can_work_leads(auth.uid()));

CREATE POLICY "Managers can delete candidates"
  ON public.prospect_candidates FOR DELETE TO authenticated
  USING (public.can_manage_business(auth.uid()));

CREATE INDEX prospect_candidates_status_idx ON public.prospect_candidates (candidate_status, created_at DESC);
CREATE INDEX prospect_candidates_campaign_idx ON public.prospect_candidates (campaign_id);
CREATE INDEX prospect_candidates_name_trgm_idx ON public.prospect_candidates USING gin (business_name_normalized gin_trgm_ops);

ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS business_name_normalized text;

CREATE OR REPLACE FUNCTION public.set_business_name_normalized()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.business_name_normalized = public.normalize_business_name(NEW.business_name);
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER prospect_candidates_normalize
  BEFORE INSERT OR UPDATE ON public.prospect_candidates
  FOR EACH ROW EXECUTE FUNCTION public.set_business_name_normalized();

CREATE TRIGGER prospects_normalize_name
  BEFORE INSERT OR UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.set_business_name_normalized();

UPDATE public.prospects
SET business_name_normalized = public.normalize_business_name(business_name)
WHERE business_name_normalized IS NULL;

CREATE INDEX prospects_name_trgm_idx ON public.prospects USING gin (business_name_normalized gin_trgm_ops);

ALTER TABLE public.prospect_campaigns ADD COLUMN IF NOT EXISTS pipeline_version text NOT NULL DEFAULT 'v3';
ALTER TABLE public.prospect_campaigns ADD COLUMN IF NOT EXISTS enrichment_budget_daily integer NOT NULL DEFAULT 50;