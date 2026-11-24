-- ============================================================
-- Tell the admin when a player report comes in.
--
-- Until now a report just sat in the Player reports page until someone happened to look. Now every new report
-- puts a notice in the admin account's notification bell ("New player report", or "3 player reports to review"
-- when several are waiting) that opens /admin/reports. There is one unread notice at a time: a new report
-- replaces the unread one with an updated count, so a burst of reports never piles up in the bell.
--
-- What it changes:
--   * widens the allowed notification types by one ('player_report'); the twelve existing types are unchanged
--   * adds a trigger on player_reports (after a report is saved) that writes the notice
-- A failure to write the notice can never stop a report from being saved. Nothing existing is edited or deleted.
-- The admin is the account whose email is contact@roberthamill.design (the same rule as is_admin()).
-- Safe to run twice. Run after 20261107100000_ranked_results.sql.
-- ============================================================

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%draft_invite%'
  LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'draft_invite', 'league_invite', 'upcoming_draft', 'your_turn',
    'table_starts_soon', 'time_to_start', 'schedule_changed', 'you_are_host',
    'table_cancelled', 'removed_from_table', 'match_found', 'results_ready',
    'player_report'
  )) NOT VALID;

CREATE OR REPLACE FUNCTION public._notify_admin_of_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid;
  v_open  integer;
  v_name  text;
BEGIN
  BEGIN
    SELECT id INTO v_admin FROM auth.users WHERE lower(email) = 'contact@roberthamill.design' LIMIT 1;
    IF v_admin IS NULL THEN RETURN NEW; END IF;

    SELECT count(*)::integer INTO v_open FROM public.player_reports WHERE status = 'open';
    SELECT public_name INTO v_name FROM public.profiles WHERE id = NEW.reported_id;

    -- One unread notice at a time, kept up to date.
    DELETE FROM public.notifications WHERE user_id = v_admin AND type = 'player_report' AND NOT is_read;

    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (
      v_admin,
      'player_report',
      CASE WHEN v_open <= 1 THEN 'New player report' ELSE v_open || ' player reports to review' END,
      COALESCE(v_name, 'A player') || ': ' || initcap(replace(NEW.reason, '_', ' ')),
      '/admin/reports',
      jsonb_build_object('open_reports', v_open)
    );
  EXCEPTION WHEN OTHERS THEN
    -- A problem with the notice must never block the report itself.
    NULL;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._notify_admin_of_report() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_admin_of_report ON public.player_reports;
CREATE TRIGGER trg_notify_admin_of_report
  AFTER INSERT ON public.player_reports
  FOR EACH ROW EXECUTE FUNCTION public._notify_admin_of_report();
