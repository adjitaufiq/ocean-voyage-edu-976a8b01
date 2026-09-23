-- Phase 6: feedback loop storage (additive only)

CREATE TABLE public.business_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_entity_id uuid NOT NULL REFERENCES public.business_entities(id) ON DELETE CASCADE,
  channel text NOT NULL,
  direction text NOT NULL DEFAULT 'inbound',
  content text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  legacy_type text,
  legacy_id uuid,
  recorded_by uuid,
  analysis_id uuid REFERENCES public.business_consultant_analyses(id) ON DELETE SET NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_interactions TO authenticated;
GRANT ALL ON public.business_interactions TO service_role;
ALTER TABLE public.business_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace can read interactions" ON public.business_interactions
  FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid()));
CREATE POLICY "sales can add interactions" ON public.business_interactions
  FOR INSERT TO authenticated WITH CHECK (public.can_work_leads(auth.uid()));
CREATE POLICY "sales can update interactions" ON public.business_interactions
  FOR UPDATE TO authenticated USING (public.can_work_leads(auth.uid())) WITH CHECK (public.can_work_leads(auth.uid()));
CREATE POLICY "managers can delete interactions" ON public.business_interactions
  FOR DELETE TO authenticated USING (public.can_manage_business(auth.uid()));

CREATE INDEX idx_business_interactions_entity ON public.business_interactions(business_entity_id, occurred_at DESC);
CREATE INDEX idx_business_interactions_legacy ON public.business_interactions(legacy_type, legacy_id);

CREATE TRIGGER business_interactions_updated_at
  BEFORE UPDATE ON public.business_interactions
  FOR EACH ROW EXECUTE FUNCTION public.set_proposals_updated_at();

CREATE TABLE public.business_objections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_entity_id uuid NOT NULL REFERENCES public.business_entities(id) ON DELETE CASCADE,
  interaction_id uuid REFERENCES public.business_interactions(id) ON DELETE SET NULL,
  category text NOT NULL,
  quote text,
  response text,
  resolution text NOT NULL DEFAULT 'open',
  confidence numeric,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_objections TO authenticated;
GRANT ALL ON public.business_objections TO service_role;
ALTER TABLE public.business_objections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace can read objections" ON public.business_objections
  FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid()));
CREATE POLICY "sales can add objections" ON public.business_objections
  FOR INSERT TO authenticated WITH CHECK (public.can_work_leads(auth.uid()));
CREATE POLICY "sales can update objections" ON public.business_objections
  FOR UPDATE TO authenticated USING (public.can_work_leads(auth.uid())) WITH CHECK (public.can_work_leads(auth.uid()));
CREATE POLICY "managers can delete objections" ON public.business_objections
  FOR DELETE TO authenticated USING (public.can_manage_business(auth.uid()));

CREATE INDEX idx_business_objections_entity ON public.business_objections(business_entity_id, created_at DESC);

CREATE TRIGGER business_objections_updated_at
  BEFORE UPDATE ON public.business_objections
  FOR EACH ROW EXECUTE FUNCTION public.set_proposals_updated_at();

CREATE TABLE public.sales_context_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_entity_id uuid NOT NULL REFERENCES public.business_entities(id) ON DELETE CASCADE,
  analysis_id uuid REFERENCES public.business_consultant_analyses(id) ON DELETE SET NULL,
  analysis_version integer NOT NULL DEFAULT 1,
  snapshot_version integer NOT NULL DEFAULT 1,
  business_summary text,
  confirmed_facts jsonb NOT NULL DEFAULT '[]'::jsonb,
  active_hypotheses jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  objection_guidance jsonb NOT NULL DEFAULT '[]'::jsonb,
  latest_customer_info jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_solution jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_entity_id, snapshot_version)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_context_snapshots TO authenticated;
GRANT ALL ON public.sales_context_snapshots TO service_role;
ALTER TABLE public.sales_context_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace can read snapshots" ON public.sales_context_snapshots
  FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid()));
CREATE POLICY "sales can add snapshots" ON public.sales_context_snapshots
  FOR INSERT TO authenticated WITH CHECK (public.can_work_leads(auth.uid()));
CREATE POLICY "managers can delete snapshots" ON public.sales_context_snapshots
  FOR DELETE TO authenticated USING (public.can_manage_business(auth.uid()));

CREATE INDEX idx_sales_context_snapshots_entity ON public.sales_context_snapshots(business_entity_id, snapshot_version DESC);

ALTER TABLE public.business_findings
  ADD COLUMN IF NOT EXISTS topic_key text,
  ADD COLUMN IF NOT EXISTS superseded_by_id uuid REFERENCES public.business_findings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS interaction_id uuid REFERENCES public.business_interactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_business_findings_entity_topic
  ON public.business_findings(business_entity_id, topic_key);

ALTER TABLE public.business_consultant_analyses
  ADD COLUMN IF NOT EXISTS stale_reason text;