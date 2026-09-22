ALTER TABLE public.business_consultant_analyses
  ADD COLUMN IF NOT EXISTS business_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS problem_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS business_goals jsonb NOT NULL DEFAULT '[]'::jsonb;