ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS phone_source text,
  ADD COLUMN IF NOT EXISTS phone_source_url text,
  ADD COLUMN IF NOT EXISTS email_source text,
  ADD COLUMN IF NOT EXISTS email_source_url text,
  ADD COLUMN IF NOT EXISTS website_source text,
  ADD COLUMN IF NOT EXISTS website_source_url text,
  ADD COLUMN IF NOT EXISTS social_source text,
  ADD COLUMN IF NOT EXISTS social_source_url text,
  ADD COLUMN IF NOT EXISTS google_maps_url text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;