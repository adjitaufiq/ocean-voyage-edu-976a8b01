CREATE POLICY "Sales team can create leads"
ON public.consultations
FOR INSERT
TO authenticated
WITH CHECK (public.can_work_leads(auth.uid()));

GRANT INSERT ON public.consultations TO authenticated;