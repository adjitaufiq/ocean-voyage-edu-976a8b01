CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS trust_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trust_tier text NOT NULL DEFAULT 'untrusted',
  ADD COLUMN IF NOT EXISTS trust_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS trust_computed_at timestamptz;

ALTER TABLE public.prospect_candidates
  ADD COLUMN IF NOT EXISTS trust_tier text NOT NULL DEFAULT 'untrusted';

CREATE INDEX IF NOT EXISTS prospects_name_trgm_idx
  ON public.prospects USING gin (business_name_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS prospect_candidates_name_trgm_idx
  ON public.prospect_candidates USING gin (business_name_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS prospects_trust_tier_idx ON public.prospects (trust_tier);

CREATE TABLE IF NOT EXISTS public.entity_match_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_kind text NOT NULL DEFAULT 'prospect',
  prospect_a uuid NOT NULL,
  prospect_b uuid NOT NULL,
  similarity_score integer NOT NULL DEFAULT 0,
  match_reason jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'needs_review',
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_by_email text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS entity_match_candidates_pair_idx
  ON public.entity_match_candidates (entity_kind, prospect_a, prospect_b);
CREATE INDEX IF NOT EXISTS entity_match_candidates_status_idx
  ON public.entity_match_candidates (status, similarity_score DESC);

GRANT SELECT, INSERT, UPDATE ON public.entity_match_candidates TO authenticated;
GRANT ALL ON public.entity_match_candidates TO service_role;

ALTER TABLE public.entity_match_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace can read entity matches"
  ON public.entity_match_candidates FOR SELECT TO authenticated
  USING (public.has_workspace_access(auth.uid()));

CREATE POLICY "Sales can create entity matches"
  ON public.entity_match_candidates FOR INSERT TO authenticated
  WITH CHECK (public.can_work_leads(auth.uid()));

CREATE POLICY "Sales can review entity matches"
  ON public.entity_match_candidates FOR UPDATE TO authenticated
  USING (public.can_work_leads(auth.uid()))
  WITH CHECK (public.can_work_leads(auth.uid()));

CREATE TRIGGER entity_match_candidates_updated_at
  BEFORE UPDATE ON public.entity_match_candidates
  FOR EACH ROW EXECUTE FUNCTION public.set_proposals_updated_at();