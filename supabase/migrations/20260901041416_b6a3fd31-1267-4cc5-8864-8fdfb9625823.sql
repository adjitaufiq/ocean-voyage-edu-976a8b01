CREATE TABLE IF NOT EXISTS public.prospect_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text NOT NULL,
  location text NOT NULL,
  keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  solution text NOT NULL,
  daily_target integer NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'active',
  notes text,
  last_run_at timestamptz,
  total_discovered integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_campaigns TO authenticated;
GRANT ALL ON public.prospect_campaigns TO service_role;
ALTER TABLE public.prospect_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prospect_campaigns_read_team" ON public.prospect_campaigns;
CREATE POLICY "prospect_campaigns_read_team" ON public.prospect_campaigns FOR SELECT TO authenticated
  USING (public.has_workspace_access(auth.uid()));

DROP POLICY IF EXISTS "prospect_campaigns_insert_sales" ON public.prospect_campaigns;
CREATE POLICY "prospect_campaigns_insert_sales" ON public.prospect_campaigns FOR INSERT TO authenticated
  WITH CHECK (public.can_work_leads(auth.uid()));

DROP POLICY IF EXISTS "prospect_campaigns_update_sales" ON public.prospect_campaigns;
CREATE POLICY "prospect_campaigns_update_sales" ON public.prospect_campaigns FOR UPDATE TO authenticated
  USING (public.can_work_leads(auth.uid()))
  WITH CHECK (public.can_work_leads(auth.uid()));

DROP POLICY IF EXISTS "prospect_campaigns_delete_manage" ON public.prospect_campaigns;
CREATE POLICY "prospect_campaigns_delete_manage" ON public.prospect_campaigns FOR DELETE TO authenticated
  USING (public.can_manage_business(auth.uid()));

DROP TRIGGER IF EXISTS prospect_campaigns_updated_at ON public.prospect_campaigns;
CREATE TRIGGER prospect_campaigns_updated_at BEFORE UPDATE ON public.prospect_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_proposals_updated_at();

ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.prospect_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS social_media text,
  ADD COLUMN IF NOT EXISTS business_summary text,
  ADD COLUMN IF NOT EXISTS opportunity_reason text,
  ADD COLUMN IF NOT EXISTS recommended_solution text,
  ADD COLUMN IF NOT EXISTS sales_approach text,
  ADD COLUMN IF NOT EXISTS last_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS prospects_campaign_idx ON public.prospects (campaign_id, created_at DESC);