DROP POLICY IF EXISTS "Branding accessible publiquement" ON storage.objects;

CREATE POLICY "Logo branding accessible publiquement"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'branding'
  AND (
    name LIKE 'logo.%'
    OR name LIKE 'logo-%'
    OR name LIKE 'public/%'
  )
);