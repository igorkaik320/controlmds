CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

DROP POLICY IF EXISTS "Authenticated users can insert empresas" ON public.empresas;
DROP POLICY IF EXISTS "Authenticated users can update empresas" ON public.empresas;
DROP POLICY IF EXISTS "Authenticated users can delete empresas" ON public.empresas;

CREATE POLICY "Admins can insert empresas"
ON public.empresas FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update empresas"
ON public.empresas FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete empresas"
ON public.empresas FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));