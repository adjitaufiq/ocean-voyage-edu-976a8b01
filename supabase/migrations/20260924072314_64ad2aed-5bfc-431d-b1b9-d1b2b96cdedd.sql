ALTER TABLE public.sales_preparations
  ADD COLUMN IF NOT EXISTS business_entity_id uuid,
  ADD COLUMN IF NOT EXISTS analysis_id uuid,
  ADD COLUMN IF NOT EXISTS analysis_version integer,
  ADD COLUMN IF NOT EXISTS engine_version text,
  ADD COLUMN IF NOT EXISTS source_revision integer,
  ADD COLUMN IF NOT EXISTS generated_from_analysis boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS decision_source text NOT NULL DEFAULT 'legacy_rules',
  ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS sales_preparations_entity_idx ON public.sales_preparations (business_entity_id);
CREATE INDEX IF NOT EXISTS sales_preparations_analysis_idx ON public.sales_preparations (analysis_id);