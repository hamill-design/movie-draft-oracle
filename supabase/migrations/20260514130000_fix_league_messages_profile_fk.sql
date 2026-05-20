-- Add a FK from league_messages.user_id → profiles.id
-- so PostgREST can join author profile data.
-- (The existing FK to auth.users is in the auth schema and not visible to PostgREST.)
ALTER TABLE public.league_messages
  ADD CONSTRAINT league_messages_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
