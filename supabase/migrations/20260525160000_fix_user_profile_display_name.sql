CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_display_name text;
BEGIN
  user_display_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(split_part(NEW.email, '@', 1), ''),
    'Usuário'
  );

  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.id) THEN
    UPDATE public.profiles
    SET
      display_name = CASE
        WHEN display_name IS NULL
          OR display_name = ''
          OR display_name ILIKE 'Usuário %'
          OR display_name = 'Sem nome'
        THEN user_display_name
        ELSE display_name
      END,
      updated_at = now()
    WHERE user_id = NEW.id;
  ELSE
    INSERT INTO public.profiles (user_id, display_name, role, ativo, created_at, updated_at)
    VALUES (NEW.id, user_display_name, 'operador', true, now(), now());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'operador');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
