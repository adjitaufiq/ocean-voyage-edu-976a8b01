DROP POLICY IF EXISTS "Sales team can update client projects" ON public.client_projects;
CREATE POLICY "Sales team can update client projects" ON public.client_projects
  FOR UPDATE TO authenticated
  USING (public.can_manage_business(auth.uid()) OR public.is_project_member(auth.uid(), id))
  WITH CHECK (public.can_manage_business(auth.uid()) OR public.is_project_member(auth.uid(), id));