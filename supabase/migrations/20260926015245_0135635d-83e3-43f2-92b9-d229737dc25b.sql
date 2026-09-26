ALTER TABLE public.entity_match_history
  ADD COLUMN IF NOT EXISTS original_status text NULL,
  ADD COLUMN IF NOT EXISTS decision_previous_entity_id uuid NULL,
  ADD COLUMN IF NOT EXISTS decided_by uuid NULL,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz NULL;

ALTER TABLE public.entity_resolution_runs
  ADD COLUMN IF NOT EXISTS lease_until timestamptz NULL,
  ADD COLUMN IF NOT EXISTS page_size integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS created INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS matched INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_required INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz NULL;

-- Only one active (pending/running) repair job per source at a time.
CREATE UNIQUE INDEX IF NOT EXISTS entity_resolution_runs_one_active_uidx
  ON public.entity_resolution_runs(source_type) WHERE status IN ('pending', 'running');