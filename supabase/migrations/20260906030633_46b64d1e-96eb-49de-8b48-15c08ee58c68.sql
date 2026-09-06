ALTER TABLE public.prospect_candidates DROP CONSTRAINT prospect_candidates_status_check;
ALTER TABLE public.prospect_candidates ADD CONSTRAINT prospect_candidates_status_check CHECK (candidate_status = ANY (ARRAY['discovered'::text,'enriching'::text,'verified'::text,'pending_review'::text,'approved'::text,'rejected'::text,'promoted'::text]));

ALTER TABLE public.prospect_candidates
  ADD COLUMN IF NOT EXISTS icp_reason text,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by_email text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_note text,
  ADD COLUMN IF NOT EXISTS review_requested_at timestamptz;

CREATE TABLE IF NOT EXISTS public.prospect_candidate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.prospect_candidates(id) ON DELETE CASCADE,
  event text NOT NULL,
  field text,
  old_value text,
  new_value text,
  actor_kind text NOT NULL DEFAULT 'human' CHECK (actor_kind = ANY (ARRAY['ai','external','human','system'])),
  actor_label text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  data_source text,
  data_source_url text,
  reason text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prospect_candidate_events_candidate_idx
  ON public.prospect_candidate_events (candidate_id, created_at DESC);

GRANT SELECT, INSERT ON public.prospect_candidate_events TO authenticated;
GRANT ALL ON public.prospect_candidate_events TO service_role;

ALTER TABLE public.prospect_candidate_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace can read candidate events"
  ON public.prospect_candidate_events FOR SELECT TO authenticated
  USING (public.has_workspace_access(auth.uid()));

CREATE POLICY "Sales can write candidate events"
  ON public.prospect_candidate_events FOR INSERT TO authenticated
  WITH CHECK (public.can_work_leads(auth.uid()));