ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS validation_stage text NOT NULL DEFAULT 'raw',
  ADD COLUMN IF NOT EXISTS validation_checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS validation_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validation_notes text,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS quality_gate jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS quality_gate_passed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rejected_reason text,
  ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES public.prospects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS prospects_validation_stage_idx ON public.prospects (validation_stage);

ALTER TABLE public.prospect_campaigns
  ADD COLUMN IF NOT EXISTS validation_accuracy numeric,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_reason text;

CREATE TABLE IF NOT EXISTS public.prospect_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.prospect_campaigns(id) ON DELETE SET NULL,
  batch_key text,
  ai_stage text,
  ai_claims jsonb NOT NULL DEFAULT '{}'::jsonb,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewer_verdict text,
  reviewer_notes text,
  accurate boolean,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_by_email text,
  reviewed_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.prospect_audits TO authenticated;
GRANT ALL ON public.prospect_audits TO service_role;
ALTER TABLE public.prospect_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prospect_audits_read_team" ON public.prospect_audits;
CREATE POLICY "prospect_audits_read_team" ON public.prospect_audits FOR SELECT TO authenticated
  USING (public.has_workspace_access(auth.uid()));

DROP POLICY IF EXISTS "prospect_audits_insert_sales" ON public.prospect_audits;
CREATE POLICY "prospect_audits_insert_sales" ON public.prospect_audits FOR INSERT TO authenticated
  WITH CHECK (public.can_work_leads(auth.uid()));

DROP POLICY IF EXISTS "prospect_audits_update_sales" ON public.prospect_audits;
CREATE POLICY "prospect_audits_update_sales" ON public.prospect_audits FOR UPDATE TO authenticated
  USING (public.can_work_leads(auth.uid()))
  WITH CHECK (public.can_work_leads(auth.uid()));

CREATE INDEX IF NOT EXISTS prospect_audits_prospect_idx ON public.prospect_audits (prospect_id, created_at DESC);
CREATE INDEX IF NOT EXISTS prospect_audits_campaign_idx ON public.prospect_audits (campaign_id, created_at DESC);