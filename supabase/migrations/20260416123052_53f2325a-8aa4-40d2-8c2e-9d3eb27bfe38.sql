-- Create revisoes_combustivel table
CREATE TABLE IF NOT EXISTS public.revisoes_combustivel (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  veiculo_id uuid NOT NULL,
  fornecedor_id uuid NOT NULL,
  data date NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  quilometragem_atual numeric NOT NULL DEFAULT 0,
  quilometragem_proxima numeric NOT NULL DEFAULT 0,
  tipo_medicao text NOT NULL DEFAULT 'km',
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.revisoes_combustivel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view revisoes" ON public.revisoes_combustivel FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert revisoes" ON public.revisoes_combustivel FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update revisoes" ON public.revisoes_combustivel FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete revisoes" ON public.revisoes_combustivel FOR DELETE TO authenticated USING (true);

-- Add ativo column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

-- Update admin profiles RLS to allow admins to update any profile (for editing names)
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));