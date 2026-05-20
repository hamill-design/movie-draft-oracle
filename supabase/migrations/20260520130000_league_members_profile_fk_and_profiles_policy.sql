-- Allow authenticated users to read any profile.
-- Required so league pages can display member names and avatars.
-- RLS is row-level only; email exposure is acceptable within an authenticated
-- context (members already share emails when sending draft invitations).
CREATE POLICY "Authenticated users can view any profile"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Add FK from league_members.user_id → profiles.id so PostgREST can resolve
-- the profile relationship in embedded queries.
ALTER TABLE public.league_members
  ADD CONSTRAINT league_members_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
