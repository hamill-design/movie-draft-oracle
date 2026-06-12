-- draft_invite notifications are created when a draft_participants row is
-- inserted — the user is already on the roster. Link straight to the draft
-- room (/draft/:id), not the invite-code page (/join-draft/:id).

CREATE OR REPLACE FUNCTION public.notify_draft_invite()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
BEGIN
  IF NEW.status IN ('invited', 'joined')
     AND NOT NEW.is_host
     AND NEW.user_id IS NOT NULL
  THEN
    SELECT title INTO v_title FROM public.drafts WHERE id = NEW.draft_id;

    INSERT INTO public.notifications (user_id, type, title, body, link, reference_id)
    VALUES (
      NEW.user_id,
      'draft_invite',
      'You''ve been invited to a draft',
      COALESCE(v_title, 'A new draft'),
      '/draft/' || NEW.draft_id::TEXT,
      NEW.draft_id
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Fix links on notifications already stored with the old /join-draft/ path.
UPDATE public.notifications
SET link = '/draft/' || reference_id::TEXT
WHERE type = 'draft_invite'
  AND reference_id IS NOT NULL
  AND link LIKE '/join-draft/%';
