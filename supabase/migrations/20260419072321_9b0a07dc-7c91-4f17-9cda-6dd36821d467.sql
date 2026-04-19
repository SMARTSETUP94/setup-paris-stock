-- Recreate trigger on auth.users to auto-create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Safety net: callable RPC to ensure the current user has a profile
CREATE OR REPLACE FUNCTION public.ensure_current_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _name text;
  _role app_role := 'tiers';
  _is_whitelisted boolean;
  _has_admin boolean;
  _profile public.profiles;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.* INTO _profile FROM public.profiles p WHERE p.id = _uid;
  IF FOUND THEN
    RETURN _profile;
  END IF;

  SELECT u.email,
         COALESCE(u.raw_user_meta_data->>'nom_complet', u.email)
    INTO _email, _name
  FROM auth.users u
  WHERE u.id = _uid;

  SELECT EXISTS (SELECT 1 FROM public.admin_emails WHERE lower(email) = lower(_email))
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
  VALUES (_uid, _email, _name, _role)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
  RETURNING * INTO _profile;

  RETURN _profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_current_profile() TO authenticated;