ALTER TABLE public.prospect_candidates
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS contact_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS duplicate_reason text,
  ADD COLUMN IF NOT EXISTS duplicate_confidence integer,
  ADD COLUMN IF NOT EXISTS duplicate_detected_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.country_code(_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(coalesce(_raw, '')) IN ('', 'indonesia', 'id', 'idn') THEN 'ID'
    ELSE upper(substr(regexp_replace(_raw, '[^A-Za-z]', '', 'g'), 1, 2))
  END
$$;

CREATE OR REPLACE FUNCTION public.build_dedupe_key(_name text, _city text, _country text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    concat_ws('_',
      replace(coalesce(public.normalize_business_name(_name), ''), ' ', '_'),
      replace(coalesce(public.normalize_business_name(_city), 'unknown'), ' ', '_'),
      public.country_code(_country)
    ),
    ''
  )
$$;

CREATE OR REPLACE FUNCTION public.validate_candidate_contact_data()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  channel text;
  entry jsonb;
BEGIN
  IF NEW.contact_data IS NULL THEN
    NEW.contact_data := '{}'::jsonb;
  END IF;

  IF jsonb_typeof(NEW.contact_data) <> 'object' THEN
    RAISE EXCEPTION 'contact_data must be an object';
  END IF;

  FOR channel, entry IN SELECT * FROM jsonb_each(NEW.contact_data) LOOP
    IF jsonb_typeof(entry) <> 'object' THEN
      RAISE EXCEPTION 'contact_data.% must be an object with value/source/verified_at', channel;
    END IF;
    IF coalesce(entry->>'value', '') = '' THEN
      RAISE EXCEPTION 'contact_data.% is missing value', channel;
    END IF;
    IF coalesce(entry->>'source', '') = '' THEN
      RAISE EXCEPTION 'contact_data.% is missing source provenance', channel;
    END IF;
    IF coalesce(entry->>'verified_at', '') = '' THEN
      RAISE EXCEPTION 'contact_data.% is missing verified_at', channel;
    END IF;
  END LOOP;

  NEW.dedupe_key := public.build_dedupe_key(NEW.business_name, NEW.city, NEW.country);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prospect_candidates_quality ON public.prospect_candidates;
CREATE TRIGGER prospect_candidates_quality
  BEFORE INSERT OR UPDATE ON public.prospect_candidates
  FOR EACH ROW EXECUTE FUNCTION public.validate_candidate_contact_data();

UPDATE public.prospect_candidates
SET dedupe_key = public.build_dedupe_key(business_name, city, country)
WHERE dedupe_key IS NULL;

CREATE INDEX IF NOT EXISTS prospect_candidates_dedupe_key_idx
  ON public.prospect_candidates (dedupe_key);
CREATE INDEX IF NOT EXISTS prospect_candidates_status_idx
  ON public.prospect_candidates (candidate_status);
CREATE INDEX IF NOT EXISTS prospect_candidates_campaign_idx
  ON public.prospect_candidates (campaign_id);