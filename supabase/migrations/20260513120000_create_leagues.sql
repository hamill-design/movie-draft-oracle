-- ============================================================
-- LEAGUES FEATURE
-- ============================================================

-- Leagues table
CREATE TABLE public.leagues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

-- League members
CREATE TYPE league_member_role AS ENUM ('admin', 'member');

CREATE TABLE public.league_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role league_member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(league_id, user_id)
);

ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

-- League drafts (drafts that belong to a league)
CREATE TABLE public.league_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  draft_id UUID NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(league_id, draft_id)
);

ALTER TABLE public.league_drafts ENABLE ROW LEVEL SECURITY;

-- League invites (handles both email invites and in-app username invites)
CREATE TYPE league_invite_status AS ENUM ('pending', 'accepted', 'declined', 'expired');

CREATE TABLE public.league_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Email invite fields
  invited_email TEXT,
  token UUID DEFAULT gen_random_uuid(),
  -- In-app invite fields
  invited_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  -- State
  status league_invite_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Must have either email or user_id, not neither
  CONSTRAINT invite_has_target CHECK (
    invited_email IS NOT NULL OR invited_user_id IS NOT NULL
  ),
  UNIQUE(league_id, invited_email),
  UNIQUE(league_id, invited_user_id)
);

ALTER TABLE public.league_invites ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER: generate URL-safe slug from league name
-- ============================================================
CREATE OR REPLACE FUNCTION generate_league_slug(name_input TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  suffix INT := 0;
BEGIN
  base_slug := lower(regexp_replace(trim(name_input), '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.leagues WHERE slug = final_slug) LOOP
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix;
  END LOOP;
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RLS: leagues
-- Anyone who is a member can read. Admin can update/delete.
-- ============================================================
CREATE POLICY "League members can view their leagues"
ON public.leagues FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.league_members
    WHERE league_id = leagues.id AND user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can create leagues"
ON public.leagues FOR INSERT
WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "League admin can update their league"
ON public.leagues FOR UPDATE
USING (admin_id = auth.uid());

CREATE POLICY "League admin can delete their league"
ON public.leagues FOR DELETE
USING (admin_id = auth.uid());

-- ============================================================
-- RLS: league_members
-- ============================================================
CREATE POLICY "League members can view other members"
ON public.league_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.league_members lm2
    WHERE lm2.league_id = league_members.league_id AND lm2.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert themselves as members"
ON public.league_members FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "League admin can insert any member"
ON public.league_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.leagues
    WHERE id = league_id AND admin_id = auth.uid()
  )
);

CREATE POLICY "League admin can update member roles"
ON public.league_members FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.leagues
    WHERE id = league_members.league_id AND admin_id = auth.uid()
  )
);

CREATE POLICY "League admin can remove members"
ON public.league_members FOR DELETE
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.leagues
    WHERE id = league_members.league_id AND admin_id = auth.uid()
  )
);

-- ============================================================
-- RLS: league_drafts
-- ============================================================
CREATE POLICY "League members can view league drafts"
ON public.league_drafts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.league_members
    WHERE league_id = league_drafts.league_id AND user_id = auth.uid()
  )
);

CREATE POLICY "League admin can manage league drafts"
ON public.league_drafts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.leagues
    WHERE id = league_id AND admin_id = auth.uid()
  )
);

CREATE POLICY "Draft owner can add their draft to a league they belong to"
ON public.league_drafts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.drafts
    WHERE id = draft_id AND user_id = auth.uid()
  )
  AND
  EXISTS (
    SELECT 1 FROM public.league_members
    WHERE league_id = league_drafts.league_id AND user_id = auth.uid()
  )
);

CREATE POLICY "League admin can remove league drafts"
ON public.league_drafts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.leagues
    WHERE id = league_drafts.league_id AND admin_id = auth.uid()
  )
);

-- ============================================================
-- RLS: league_invites
-- ============================================================
CREATE POLICY "Invited user can view their own invites"
ON public.league_invites FOR SELECT
USING (
  invited_user_id = auth.uid() OR
  invited_email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR
  invited_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.leagues
    WHERE id = league_invites.league_id AND admin_id = auth.uid()
  )
);

CREATE POLICY "League admin can create invites"
ON public.league_invites FOR INSERT
WITH CHECK (
  invited_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.leagues
    WHERE id = league_id AND admin_id = auth.uid()
  )
);

CREATE POLICY "Invited user can update their invite status"
ON public.league_invites FOR UPDATE
USING (
  invited_user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.leagues
    WHERE id = league_invites.league_id AND admin_id = auth.uid()
  )
);

CREATE POLICY "League admin can delete invites"
ON public.league_invites FOR DELETE
USING (
  invited_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.leagues
    WHERE id = league_invites.league_id AND admin_id = auth.uid()
  )
);

-- ============================================================
-- FUNCTION: accept invite by token (email link flow)
-- ============================================================
CREATE OR REPLACE FUNCTION accept_league_invite_by_token(token_param UUID)
RETURNS UUID AS $$
DECLARE
  invite_record public.league_invites;
BEGIN
  SELECT * INTO invite_record
  FROM public.league_invites
  WHERE token = token_param
    AND status = 'pending'
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found, already used, or expired';
  END IF;

  -- Mark accepted
  UPDATE public.league_invites
  SET status = 'accepted'
  WHERE id = invite_record.id;

  -- Add to league_members (ignore if already a member)
  INSERT INTO public.league_members (league_id, user_id, role)
  VALUES (invite_record.league_id, auth.uid(), 'member')
  ON CONFLICT (league_id, user_id) DO NOTHING;

  RETURN invite_record.league_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: accept in-app invite (username search flow)
-- ============================================================
CREATE OR REPLACE FUNCTION accept_league_invite(invite_id_param UUID)
RETURNS UUID AS $$
DECLARE
  invite_record public.league_invites;
BEGIN
  SELECT * INTO invite_record
  FROM public.league_invites
  WHERE id = invite_id_param
    AND invited_user_id = auth.uid()
    AND status = 'pending'
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found or not addressed to you';
  END IF;

  UPDATE public.league_invites
  SET status = 'accepted'
  WHERE id = invite_record.id;

  INSERT INTO public.league_members (league_id, user_id, role)
  VALUES (invite_record.league_id, auth.uid(), 'member')
  ON CONFLICT (league_id, user_id) DO NOTHING;

  RETURN invite_record.league_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: promote oldest member when admin leaves
-- ============================================================
CREATE OR REPLACE FUNCTION promote_oldest_member_on_admin_leave()
RETURNS TRIGGER AS $$
DECLARE
  next_admin UUID;
  league_record public.leagues;
BEGIN
  SELECT * INTO league_record FROM public.leagues WHERE id = OLD.league_id;

  -- Only act if the departing member was the admin
  IF league_record.admin_id = OLD.user_id THEN
    SELECT user_id INTO next_admin
    FROM public.league_members
    WHERE league_id = OLD.league_id AND user_id <> OLD.user_id
    ORDER BY joined_at ASC
    LIMIT 1;

    IF next_admin IS NOT NULL THEN
      UPDATE public.leagues SET admin_id = next_admin, updated_at = now()
      WHERE id = OLD.league_id;

      UPDATE public.league_members SET role = 'admin'
      WHERE league_id = OLD.league_id AND user_id = next_admin;
    ELSE
      -- No members left, delete the league
      DELETE FROM public.leagues WHERE id = OLD.league_id;
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_promote_on_admin_leave
  AFTER DELETE ON public.league_members
  FOR EACH ROW
  EXECUTE FUNCTION promote_oldest_member_on_admin_leave();

-- ============================================================
-- VIEW: league standings (aggregated scores per user per league)
-- Scores live on draft_picks.calculated_score, linked to users
-- via draft_participants (user_id → participant_name = player_name)
-- ============================================================
CREATE OR REPLACE VIEW public.league_standings AS
SELECT
  lm.league_id,
  lm.user_id,
  p.name AS display_name,
  p.avatar_url AS photo_url,
  COUNT(DISTINCT ld.draft_id) AS draft_count,
  COALESCE(SUM(dp.calculated_score), 0) AS total_score,
  ROW_NUMBER() OVER (
    PARTITION BY lm.league_id
    ORDER BY COALESCE(SUM(dp.calculated_score), 0) DESC
  ) AS rank
FROM public.league_members lm
JOIN public.profiles p ON p.id = lm.user_id
LEFT JOIN public.league_drafts ld ON ld.league_id = lm.league_id
LEFT JOIN public.draft_participants dpart
  ON dpart.draft_id = ld.draft_id
  AND dpart.user_id = lm.user_id
LEFT JOIN public.draft_picks dp
  ON dp.draft_id = ld.draft_id
  AND dp.player_name = dpart.participant_name
GROUP BY lm.league_id, lm.user_id, p.name, p.avatar_url;

-- ============================================================
-- Enable realtime for collaborative features
-- ============================================================
ALTER TABLE public.leagues REPLICA IDENTITY FULL;
ALTER TABLE public.league_members REPLICA IDENTITY FULL;
ALTER TABLE public.league_invites REPLICA IDENTITY FULL;
