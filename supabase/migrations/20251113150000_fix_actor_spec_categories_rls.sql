-- Fix RLS policy for actor_spec_categories to allow authenticated users to write
-- The frontend already checks for admin email, so we just need to allow authenticated writes

-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Allow admin modifications" ON public.actor_spec_categories;

-- Create a policy that allows authenticated users to modify
-- Frontend enforces admin email check, so database just needs to allow authenticated writes
-- Note: Even with USING (true), Supabase may require auth.uid() IS NOT NULL for writes
CREATE POLICY "Authenticated users can modify actor spec categories" 
  ON public.actor_spec_categories 
  FOR ALL 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

