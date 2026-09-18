ALTER TABLE public.prospect_candidates
  ADD COLUMN IF NOT EXISTS pain_signal text,
  ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS validation_reason text,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS validation_checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS qualified_at timestamptz;

CREATE INDEX IF NOT EXISTS prospect_candidates_validation_status_idx
  ON public.prospect_candidates (validation_status);
CREATE INDEX IF NOT EXISTS prospect_candidates_qc_status_idx
  ON public.prospect_candidates (qc_status);