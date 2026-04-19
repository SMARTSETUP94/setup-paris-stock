-- Table des invitations & resets custom (Resend)
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'invite_admin',
  role public.app_role,
  nom_complet text,
  inviter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  expire_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitations_kind_check CHECK (kind IN ('invite_admin', 'password_reset'))
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(lower(email));

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gèrent invitations"
  ON public.invitations
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
