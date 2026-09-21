-- ENUMS
CREATE TYPE public.business_legacy_type AS ENUM ('prospect_candidate','prospect','consultation','ai_conversation','client');
CREATE TYPE public.business_finding_kind AS ENUM ('fact','hypothesis');
CREATE TYPE public.business_finding_validation AS ENUM ('unvalidated','confirmed','rejected','superseded');
CREATE TYPE public.business_analysis_status AS ENUM ('pending','running','completed','failed','stale');

-- A. business_entities
CREATE TABLE public.business_entities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  normalized_name TEXT,
  industry TEXT,
  business_model TEXT,
  address TEXT,
  city TEXT,
  province TEXT,
  country TEXT DEFAULT 'ID',
  website TEXT,
  website_domain TEXT,
  google_place_id TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  current_stage TEXT NOT NULL DEFAULT 'discovered',
  source_revision INTEGER NOT NULL DEFAULT 1,
  current_analysis_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_entities TO authenticated;
GRANT ALL ON public.business_entities TO service_role;
ALTER TABLE public.business_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_entities_select" ON public.business_entities FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid()));
CREATE POLICY "business_entities_insert" ON public.business_entities FOR INSERT TO authenticated WITH CHECK (public.can_work_leads(auth.uid()));
CREATE POLICY "business_entities_update" ON public.business_entities FOR UPDATE TO authenticated USING (public.can_work_leads(auth.uid())) WITH CHECK (public.can_work_leads(auth.uid()));
CREATE POLICY "business_entities_delete" ON public.business_entities FOR DELETE TO authenticated USING (public.can_manage_business(auth.uid()));

CREATE INDEX business_entities_normalized_name_idx ON public.business_entities (normalized_name);
CREATE INDEX business_entities_google_place_id_idx ON public.business_entities (google_place_id) WHERE google_place_id IS NOT NULL;
CREATE INDEX business_entities_website_domain_idx ON public.business_entities (website_domain) WHERE website_domain IS NOT NULL;
CREATE INDEX business_entities_phone_idx ON public.business_entities (phone) WHERE phone IS NOT NULL;
CREATE INDEX business_entities_whatsapp_idx ON public.business_entities (whatsapp) WHERE whatsapp IS NOT NULL;
CREATE INDEX business_entities_city_idx ON public.business_entities (city);

CREATE TRIGGER business_entities_updated_at BEFORE UPDATE ON public.business_entities FOR EACH ROW EXECUTE FUNCTION public.set_proposals_updated_at();

-- B. business_entity_links
CREATE TABLE public.business_entity_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_entity_id UUID NOT NULL REFERENCES public.business_entities(id) ON DELETE CASCADE,
  legacy_type public.business_legacy_type NOT NULL,
  legacy_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_entity_links TO authenticated;
GRANT ALL ON public.business_entity_links TO service_role;
ALTER TABLE public.business_entity_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_entity_links_select" ON public.business_entity_links FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid()));
CREATE POLICY "business_entity_links_insert" ON public.business_entity_links FOR INSERT TO authenticated WITH CHECK (public.can_work_leads(auth.uid()));
CREATE POLICY "business_entity_links_update" ON public.business_entity_links FOR UPDATE TO authenticated USING (public.can_work_leads(auth.uid())) WITH CHECK (public.can_work_leads(auth.uid()));
CREATE POLICY "business_entity_links_delete" ON public.business_entity_links FOR DELETE TO authenticated USING (public.can_manage_business(auth.uid()));

CREATE UNIQUE INDEX business_entity_links_active_legacy_uidx ON public.business_entity_links (legacy_type, legacy_id) WHERE is_active;
CREATE UNIQUE INDEX business_entity_links_pair_uidx ON public.business_entity_links (business_entity_id, legacy_type, legacy_id);
CREATE INDEX business_entity_links_entity_idx ON public.business_entity_links (business_entity_id);

-- D (before C, for FK): business_consultant_analyses
CREATE TABLE public.business_consultant_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_entity_id UUID NOT NULL REFERENCES public.business_entities(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  engine_version TEXT,
  knowledge_version TEXT,
  input_hash TEXT,
  source_revision INTEGER NOT NULL DEFAULT 1,
  status public.business_analysis_status NOT NULL DEFAULT 'pending',
  industry_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  business_model JSONB NOT NULL DEFAULT '{}'::jsonb,
  business_stage JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_facts JSONB NOT NULL DEFAULT '[]'::jsonb,
  problem_hypotheses JSONB NOT NULL DEFAULT '[]'::jsonb,
  confirmed_problems JSONB NOT NULL DEFAULT '[]'::jsonb,
  core_solution JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommended_features JSONB NOT NULL DEFAULT '[]'::jsonb,
  optional_features JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_package JSONB NOT NULL DEFAULT '{}'::jsonb,
  consultant_reasoning JSONB NOT NULL DEFAULT '{}'::jsonb,
  sales_angle JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  objection_guidance JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(5,2),
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_consultant_analyses TO authenticated;
GRANT ALL ON public.business_consultant_analyses TO service_role;
ALTER TABLE public.business_consultant_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_analyses_select" ON public.business_consultant_analyses FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid()));
CREATE POLICY "business_analyses_insert" ON public.business_consultant_analyses FOR INSERT TO authenticated WITH CHECK (public.can_work_leads(auth.uid()));
CREATE POLICY "business_analyses_update" ON public.business_consultant_analyses FOR UPDATE TO authenticated USING (public.can_work_leads(auth.uid())) WITH CHECK (public.can_work_leads(auth.uid()));
CREATE POLICY "business_analyses_delete" ON public.business_consultant_analyses FOR DELETE TO authenticated USING (public.can_manage_business(auth.uid()));

CREATE UNIQUE INDEX business_analyses_entity_version_uidx ON public.business_consultant_analyses (business_entity_id, version);
CREATE INDEX business_analyses_status_idx ON public.business_consultant_analyses (status);
CREATE INDEX business_analyses_input_hash_idx ON public.business_consultant_analyses (input_hash) WHERE input_hash IS NOT NULL;

CREATE TRIGGER business_analyses_updated_at BEFORE UPDATE ON public.business_consultant_analyses FOR EACH ROW EXECUTE FUNCTION public.set_proposals_updated_at();

ALTER TABLE public.business_entities
  ADD CONSTRAINT business_entities_current_analysis_fk
  FOREIGN KEY (current_analysis_id) REFERENCES public.business_consultant_analyses(id) ON DELETE SET NULL;

-- C. business_findings
CREATE TABLE public.business_findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_entity_id UUID NOT NULL REFERENCES public.business_entities(id) ON DELETE CASCADE,
  kind public.business_finding_kind NOT NULL,
  validation_status public.business_finding_validation NOT NULL DEFAULT 'unvalidated',
  statement TEXT NOT NULL,
  confidence NUMERIC(5,2),
  evidence_reference JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_type TEXT,
  analysis_id UUID REFERENCES public.business_consultant_analyses(id) ON DELETE SET NULL,
  validated_by UUID,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_findings TO authenticated;
GRANT ALL ON public.business_findings TO service_role;
ALTER TABLE public.business_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_findings_select" ON public.business_findings FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid()));
CREATE POLICY "business_findings_insert" ON public.business_findings FOR INSERT TO authenticated WITH CHECK (public.can_work_leads(auth.uid()));
CREATE POLICY "business_findings_update" ON public.business_findings FOR UPDATE TO authenticated USING (public.can_work_leads(auth.uid())) WITH CHECK (public.can_work_leads(auth.uid()));
CREATE POLICY "business_findings_delete" ON public.business_findings FOR DELETE TO authenticated USING (public.can_manage_business(auth.uid()));

CREATE INDEX business_findings_entity_idx ON public.business_findings (business_entity_id);
CREATE INDEX business_findings_kind_status_idx ON public.business_findings (kind, validation_status);
CREATE INDEX business_findings_analysis_idx ON public.business_findings (analysis_id) WHERE analysis_id IS NOT NULL;

CREATE TRIGGER business_findings_updated_at BEFORE UPDATE ON public.business_findings FOR EACH ROW EXECUTE FUNCTION public.set_proposals_updated_at();