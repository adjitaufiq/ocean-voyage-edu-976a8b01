CREATE TABLE public.decision_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_entity_id uuid NULL REFERENCES public.business_entities(id) ON DELETE SET NULL,
  legacy_type text NULL,
  legacy_id text NULL,
  source_module text NOT NULL,
  decision_type text NOT NULL,
  decision_output jsonb NOT NULL DEFAULT '{}'::jsonb,
  analysis_id uuid NULL,
  analysis_version integer NULL,
  engine_version text NULL,
  evidence_source jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric NULL,
  actor_kind text NOT NULL DEFAULT 'system',
  actor_id text NULL,
  override_info jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.decision_traces TO authenticated;
GRANT ALL ON public.decision_traces TO service_role;
ALTER TABLE public.decision_traces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace can read decision traces" ON public.decision_traces
  FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid()));
CREATE INDEX decision_traces_entity_idx ON public.decision_traces (business_entity_id, created_at DESC);
CREATE INDEX decision_traces_legacy_idx ON public.decision_traces (legacy_type, legacy_id);
CREATE INDEX decision_traces_module_idx ON public.decision_traces (source_module, decision_type, created_at DESC);