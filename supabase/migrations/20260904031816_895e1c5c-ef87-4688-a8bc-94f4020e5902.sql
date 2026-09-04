ALTER TABLE public.prospect_campaigns
  ADD COLUMN IF NOT EXISTS solutions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_solutions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS primary_solution text;

UPDATE public.prospect_campaigns
SET solutions = to_jsonb(ARRAY[solution]),
    primary_solution = solution
WHERE (solutions = '[]'::jsonb OR solutions IS NULL) AND solution IS NOT NULL AND solution <> '';