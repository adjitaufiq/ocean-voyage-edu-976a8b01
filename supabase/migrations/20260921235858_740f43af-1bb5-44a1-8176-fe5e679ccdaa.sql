CREATE TABLE public.entity_match_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type public.business_legacy_type NOT NULL,
  source_id UUID NOT NULL,
  candidate_entity_id UUID REFERENCES public.business_entities(id) ON DELETE SET NULL,
  matched_entity_id UUID REFERENCES public.business_entities(id) ON DELETE SET NULL,
  matching_method TEXT NOT NULL,
  confidence_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'auto_matched',
  comparison JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT entity_match_history_status_check CHECK (status IN ('auto_matched','suggested','review_required','rejected','created'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_match_history TO authenticated;
GRANT ALL ON public.entity_match_history TO service_role;
ALTER TABLE public.entity_match_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entity_match_history_select" ON public.entity_match_history FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid()));
CREATE POLICY "entity_match_history_insert" ON public.entity_match_history FOR INSERT TO authenticated WITH CHECK (public.can_work_leads(auth.uid()));
CREATE POLICY "entity_match_history_update" ON public.entity_match_history FOR UPDATE TO authenticated USING (public.can_work_leads(auth.uid())) WITH CHECK (public.can_work_leads(auth.uid()));
CREATE POLICY "entity_match_history_delete" ON public.entity_match_history FOR DELETE TO authenticated USING (public.can_manage_business(auth.uid()));
CREATE INDEX entity_match_history_source_idx ON public.entity_match_history (source_type, source_id);
CREATE INDEX entity_match_history_status_idx ON public.entity_match_history (status);
CREATE INDEX entity_match_history_matched_idx ON public.entity_match_history (matched_entity_id);
CREATE INDEX entity_match_history_created_idx ON public.entity_match_history (created_at DESC);