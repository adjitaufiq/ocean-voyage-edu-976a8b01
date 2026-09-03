ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS business_profile text,
  ADD COLUMN IF NOT EXISTS industry_fit text,
  ADD COLUMN IF NOT EXISTS sales_priority text;