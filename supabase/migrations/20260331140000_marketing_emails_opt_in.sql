-- Marketing email consent (Resend Audience sync; source of truth in app DB)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_emails_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_emails_opt_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_emails_opt_out_at timestamptz;

COMMENT ON COLUMN public.profiles.marketing_emails_opt_in IS 'User opted in to product/marketing emails (not transactional).';
COMMENT ON COLUMN public.profiles.marketing_emails_opt_in_at IS 'When the user last opted in.';
COMMENT ON COLUMN public.profiles.marketing_emails_opt_out_at IS 'When the user last opted out or unsubscribed via provider.';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  wants_marketing boolean;
BEGIN
  wants_marketing :=
    (new.raw_user_meta_data->'marketing_emails_opt_in' = 'true'::jsonb)
    OR (new.raw_user_meta_data->>'marketing_emails_opt_in') = 'true';

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
