CREATE TABLE IF NOT EXISTS public.sales_preparations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES public.prospect_candidates(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.prospect_campaigns(id) ON DELETE SET NULL,
  business_brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  approach_category text NOT NULL DEFAULT 'website_opportunity',
  approach_reason text,
  recommended_solution text,
  outreach_message jsonb NOT NULL DEFAULT '{}'::jsonb,
  selected_asset jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_by text NOT NULL DEFAULT 'rules',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_preparations TO authenticated;
GRANT ALL ON public.sales_preparations TO service_role;

ALTER TABLE public.sales_preparations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace can view sales preparations"
  ON public.sales_preparations FOR SELECT TO authenticated
  USING (public.has_workspace_access(auth.uid()));

CREATE POLICY "Sales can insert sales preparations"
  ON public.sales_preparations FOR INSERT TO authenticated
  WITH CHECK (public.can_work_leads(auth.uid()));

CREATE POLICY "Sales can update sales preparations"
  ON public.sales_preparations FOR UPDATE TO authenticated
  USING (public.can_work_leads(auth.uid()))
  WITH CHECK (public.can_work_leads(auth.uid()));

CREATE POLICY "Managers can delete sales preparations"
  ON public.sales_preparations FOR DELETE TO authenticated
  USING (public.can_manage_business(auth.uid()));

CREATE INDEX IF NOT EXISTS sales_preparations_candidate_idx
  ON public.sales_preparations (candidate_id, is_active);
CREATE INDEX IF NOT EXISTS sales_preparations_campaign_idx
  ON public.sales_preparations (campaign_id);

CREATE TRIGGER sales_preparations_updated_at
  BEFORE UPDATE ON public.sales_preparations
  FOR EACH ROW EXECUTE FUNCTION public.set_proposals_updated_at();

ALTER TABLE public.prospect_candidates
  ADD COLUMN IF NOT EXISTS sales_stage text NOT NULL DEFAULT 'qualified',
  ADD COLUMN IF NOT EXISTS sales_prepared_at timestamptz;

CREATE INDEX IF NOT EXISTS prospect_candidates_sales_stage_idx
  ON public.prospect_candidates (sales_stage);