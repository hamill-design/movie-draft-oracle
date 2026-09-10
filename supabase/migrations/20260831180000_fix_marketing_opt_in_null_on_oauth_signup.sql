-- Fix: new users signing up via OAuth (e.g. Google) have no
-- `marketing_emails_opt_in` key in raw_user_meta_data at all (only the
-- email/password signup form sends one). With no key present, both sides of
-- the OR below evaluated to SQL NULL, and NULL OR NULL is NULL (not false) --
-- which then violated the NOT NULL constraint on marketing_emails_opt_in and
-- rolled back the entire auth.users insert, silently failing every new
-- Google sign-up. Coalesce to false so a missing/malformed value never
-- reaches the insert as NULL.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  wants_marketing boolean;
BEGIN
  wants_marketing := COALESCE(
    (new.raw_user_meta_data->'marketing_emails_opt_in' = 'true'::jsonb)
    OR (new.raw_user_meta_data->>'marketing_emails_opt_in') = 'true',
    false
  );

  INSERT INTO public.profiles (
    id,
    email,
    name,
    marketing_emails_opt_in,
    marketing_emails_opt_in_at,
    marketing_emails_opt_out_at
  )
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'name',
    wants_marketing,
    CASE WHEN wants_marketing THEN now() ELSE NULL END,
    NULL
  );
  RETURN new;
END;
$$;
