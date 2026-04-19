
-- 1. Whitelist emails admin
CREATE TABLE IF NOT EXISTS public.admin_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gèrent admin_emails"
ON public.admin_emails
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.admin_emails (email) VALUES
  ('smart@setup.paris'),
  ('g.chaussegros@groupe-smart.fr')
ON CONFLICT (email) DO NOTHING;

-- 2. Updated handle_new_user with bootstrap logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role app_role := 'tiers';
  _is_whitelisted boolean;
  _has_admin boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.admin_emails WHERE lower(email) = lower(NEW.email))
    INTO _is_whitelisted;

  IF _is_whitelisted THEN
    _role := 'admin';
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin' AND actif = true)
      INTO _has_admin;
    IF NOT _has_admin THEN
      _role := 'admin';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, nom_complet, role)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom_complet', NEW.email),
    _role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
