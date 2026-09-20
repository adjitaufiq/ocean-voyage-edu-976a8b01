ALTER TABLE public.prospect_candidates
  ADD COLUMN IF NOT EXISTS confidence_score integer,
  ADD COLUMN IF NOT EXISTS screening_label text,
  ADD COLUMN IF NOT EXISTS auto_qc_reason text,
  ADD COLUMN IF NOT EXISTS verification_checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS verified_ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by text,
  ADD COLUMN IF NOT EXISTS contact_stage text;

ALTER TABLE public.sales_preparations
  ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS prospect_candidates_screening_label_idx
  ON public.prospect_candidates (screening_label);
CREATE INDEX IF NOT EXISTS prospect_candidates_contact_stage_idx
  ON public.prospect_candidates (contact_stage);