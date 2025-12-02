-- Fix RLS policy for actor_spec_categories to allow authenticated users to write
-- Run this in Supabase SQL Editor

-- First, ensure RLS is enabled
ALTER TABLE public.actor_spec_categories ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies (cleanup)
DROP POLICY IF EXISTS "Allow admin modifications" ON public.actor_spec_categories;
DROP POLICY IF EXISTS "Authenticated users can modify actor spec categories" ON public.actor_spec_categories;
DROP POLICY IF EXISTS "Actor spec categories are publicly readable" ON public.actor_spec_categories;

-- Create SELECT policy (public read access)
CREATE POLICY "Actor spec categories are publicly readable" 
  ON public.actor_spec_categories 
  FOR SELECT 
  USING (true);

-- Create INSERT/UPDATE/DELETE policy (authenticated users only)
-- Frontend enforces admin email check, so database just needs to allow authenticated writes
CREATE POLICY "Authenticated users can modify actor spec categories" 
  ON public.actor_spec_categories 
  FOR ALL 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

