ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS potential_need text,
  ADD COLUMN IF NOT EXISTS business_problem text,
  ADD COLUMN IF NOT EXISTS buying_signal text,
  ADD COLUMN IF NOT EXISTS decision_maker text;