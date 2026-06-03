CREATE TABLE IF NOT EXISTS public.avisos_configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  modulo TEXT NOT NULL DEFAULT 'financeiro',
  tipo TEXT NOT NULL,
  dias_antecedencia INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  mostrar_link_consulta BOOLEAN NOT NULL DEFAULT true,
  mostrar_link_relatorio BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.avisos_configuracoes_usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aviso_id UUID NOT NULL REFERENCES public.avisos_configuracoes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (aviso_id, user_id)
);

ALTER TABLE public.avisos_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avisos_configuracoes_usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view avisos configuracoes"
  ON public.avisos_configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert avisos configuracoes"
  ON public.avisos_configuracoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update avisos configuracoes"
  ON public.avisos_configuracoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete avisos configuracoes"
  ON public.avisos_configuracoes FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth users can view avisos usuarios"
  ON public.avisos_configuracoes_usuarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert avisos usuarios"
  ON public.avisos_configuracoes_usuarios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update avisos usuarios"
  ON public.avisos_configuracoes_usuarios FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete avisos usuarios"
  ON public.avisos_configuracoes_usuarios FOR DELETE TO authenticated USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_avisos_configuracoes_updated_at'
  ) THEN
    CREATE TRIGGER update_avisos_configuracoes_updated_at
    BEFORE UPDATE ON public.avisos_configuracoes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
