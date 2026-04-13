
CREATE TABLE IF NOT EXISTS public.empresas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    cnpj VARCHAR(20),
    logo_esquerda TEXT,
    logo_direita TEXT,
    cor_cabecalho VARCHAR(20),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view empresas"
    ON public.empresas FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert empresas"
    ON public.empresas FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update empresas"
    ON public.empresas FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can delete empresas"
    ON public.empresas FOR DELETE
    TO authenticated
    USING (true);

CREATE TRIGGER update_empresas_updated_at
    BEFORE UPDATE ON public.empresas
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
