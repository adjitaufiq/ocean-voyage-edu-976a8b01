CREATE TABLE IF NOT EXISTS public.assistant_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  summary text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_hash text NOT NULL,
  thread_id uuid,
  origin text NOT NULL DEFAULT 'web',
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid NOT NULL,
  confirmed_by uuid,
  confirmed_at timestamptz,
  executed_at timestamptz,
  result text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assistant_pending_actions_status_check
    CHECK (status IN ('pending','confirmed','executed','cancelled','expired','failed'))
);

GRANT SELECT, INSERT, UPDATE ON public.assistant_pending_actions TO authenticated;
GRANT ALL ON public.assistant_pending_actions TO service_role;

ALTER TABLE public.assistant_pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members read their own pending actions"
  ON public.assistant_pending_actions FOR SELECT TO authenticated
  USING (public.has_workspace_access(auth.uid()) AND requested_by = auth.uid());

CREATE POLICY "Workspace members create their own pending actions"
  ON public.assistant_pending_actions FOR INSERT TO authenticated
  WITH CHECK (public.can_work_leads(auth.uid()) AND requested_by = auth.uid());

CREATE POLICY "Workspace members update their own pending actions"
  ON public.assistant_pending_actions FOR UPDATE TO authenticated
  USING (public.can_work_leads(auth.uid()) AND requested_by = auth.uid())
  WITH CHECK (requested_by = auth.uid());

CREATE INDEX IF NOT EXISTS assistant_pending_actions_open_idx
  ON public.assistant_pending_actions (requested_by, status, created_at DESC);

CREATE TRIGGER assistant_pending_actions_updated_at
  BEFORE UPDATE ON public.assistant_pending_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_proposals_updated_at();

ALTER TABLE public.assistant_memories
  ADD COLUMN IF NOT EXISTS provenance text NOT NULL DEFAULT 'assistant_recommendation';

ALTER TABLE public.assistant_memories
  DROP CONSTRAINT IF EXISTS assistant_memories_provenance_check;

ALTER TABLE public.assistant_memories
  ADD CONSTRAINT assistant_memories_provenance_check
  CHECK (provenance IN ('database_fact','user_confirmed_fact','user_preference','assistant_recommendation','hypothesis'));