ALTER TABLE public.business_entities
  ADD COLUMN IF NOT EXISTS replaced_by_entity_id uuid NULL REFERENCES public.business_entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replaced_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS replaced_reason text NULL;

CREATE INDEX IF NOT EXISTS business_entities_replaced_by_idx ON public.business_entities(replaced_by_entity_id) WHERE replaced_by_entity_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS business_entities_place_id_uidx
  ON public.business_entities(google_place_id)
  WHERE google_place_id IS NOT NULL AND replaced_by_entity_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS business_entities_domain_uidx
  ON public.business_entities(website_domain)
  WHERE website_domain IS NOT NULL AND replaced_by_entity_id IS NULL;

-- Atomic find-or-create by strong identity (place id / domain).
CREATE OR REPLACE FUNCTION public.find_or_create_business_entity(_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _place text := nullif(btrim(_payload->>'google_place_id'), '');
  _domain text := nullif(lower(btrim(_payload->>'website_domain')), '');
  _lock_key text;
  _id uuid;
BEGIN
  _lock_key := coalesce('p:' || _place, 'd:' || _domain,
    'n:' || coalesce(_payload->>'normalized_name', '') || '|' || lower(coalesce(_payload->>'city', '')));
  PERFORM pg_advisory_xact_lock(hashtextextended('business_entity:' || _lock_key, 0));

  IF _place IS NOT NULL THEN
    SELECT id INTO _id FROM public.business_entities
      WHERE google_place_id = _place AND replaced_by_entity_id IS NULL LIMIT 1;
    IF _id IS NOT NULL THEN RETURN jsonb_build_object('id', _id, 'created', false, 'matched_by', 'google_place_id'); END IF;
  END IF;
  IF _domain IS NOT NULL THEN
    SELECT id INTO _id FROM public.business_entities
      WHERE website_domain = _domain AND replaced_by_entity_id IS NULL LIMIT 1;
    IF _id IS NOT NULL THEN RETURN jsonb_build_object('id', _id, 'created', false, 'matched_by', 'website_domain'); END IF;
  END IF;

  BEGIN
    INSERT INTO public.business_entities (canonical_name, normalized_name, industry, address, city, province,
      website, website_domain, google_place_id, phone, whatsapp, email, current_stage)
    VALUES (coalesce(nullif(_payload->>'canonical_name', ''), 'Tanpa nama'), _payload->>'normalized_name',
      _payload->>'industry', _payload->>'address', _payload->>'city', _payload->>'province',
      _payload->>'website', _domain, _place, _payload->>'phone', _payload->>'whatsapp', _payload->>'email',
      coalesce(nullif(_payload->>'current_stage', ''), 'candidate'))
    RETURNING id INTO _id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO _id FROM public.business_entities
      WHERE replaced_by_entity_id IS NULL
        AND ((_place IS NOT NULL AND google_place_id = _place) OR (_domain IS NOT NULL AND website_domain = _domain))
      LIMIT 1;
    RETURN jsonb_build_object('id', _id, 'created', false, 'matched_by', 'unique_guard');
  END;
  RETURN jsonb_build_object('id', _id, 'created', true, 'matched_by', null);
END;
$$;
REVOKE ALL ON FUNCTION public.find_or_create_business_entity(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_or_create_business_entity(jsonb) TO authenticated, service_role;

-- Backfill state (prepared, not run).
CREATE TABLE public.entity_resolution_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  dry_run boolean NOT NULL DEFAULT true,
  cursor_created_at timestamptz NULL,
  cursor_id uuid NULL,
  processed integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  last_error text NULL,
  started_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.entity_resolution_runs TO authenticated;
GRANT ALL ON public.entity_resolution_runs TO service_role;
ALTER TABLE public.entity_resolution_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY entity_resolution_runs_select ON public.entity_resolution_runs FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid()));
CREATE POLICY entity_resolution_runs_insert ON public.entity_resolution_runs FOR INSERT TO authenticated WITH CHECK (public.can_manage_business(auth.uid()));
CREATE POLICY entity_resolution_runs_update ON public.entity_resolution_runs FOR UPDATE TO authenticated USING (public.can_manage_business(auth.uid())) WITH CHECK (public.can_manage_business(auth.uid()));
CREATE TRIGGER entity_resolution_runs_updated_at BEFORE UPDATE ON public.entity_resolution_runs FOR EACH ROW EXECUTE FUNCTION public.set_proposals_updated_at();

CREATE TABLE public.entity_resolution_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  run_id uuid NULL REFERENCES public.entity_resolution_runs(id) ON DELETE SET NULL,
  error text NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id)
);
GRANT SELECT, INSERT, UPDATE ON public.entity_resolution_failures TO authenticated;
GRANT ALL ON public.entity_resolution_failures TO service_role;
ALTER TABLE public.entity_resolution_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY entity_resolution_failures_select ON public.entity_resolution_failures FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid()));
CREATE POLICY entity_resolution_failures_insert ON public.entity_resolution_failures FOR INSERT TO authenticated WITH CHECK (public.can_work_leads(auth.uid()));
CREATE POLICY entity_resolution_failures_update ON public.entity_resolution_failures FOR UPDATE TO authenticated USING (public.can_work_leads(auth.uid())) WITH CHECK (public.can_work_leads(auth.uid()));
CREATE TRIGGER entity_resolution_failures_updated_at BEFORE UPDATE ON public.entity_resolution_failures FOR EACH ROW EXECUTE FUNCTION public.set_proposals_updated_at();