-- Optional: Add admin-specific RLS policy for actor_spec_categories
-- This provides an extra layer of security by restricting writes to admin email
-- Note: The current policy allows all operations, so this is optional

-- Drop the existing "Allow admin modifications" policy if it exists
DROP POLICY IF EXISTS "Allow admin modifications" ON public.actor_spec_categories;

-- Create a more restrictive policy that only allows admin email to modify
-- For now, we'll keep it permissive since frontend controls access
-- Uncomment below if you want database-level enforcement:

-- CREATE POLICY "Only admin can modify actor spec categories" 
--   ON public.actor_spec_categories 
--   FOR ALL 
--   USING (
--     EXISTS (
--       SELECT 1 FROM auth.users 
--       WHERE auth.users.id = auth.uid() 
--       AND auth.users.email = 'contact@roberthamill.design'
--     )
--   )
--   WITH CHECK (
--     EXISTS (
--       SELECT 1 FROM auth.users 
--       WHERE auth.users.id = auth.uid() 
--       AND auth.users.email = 'contact@roberthamill.design'
--     )
--   );

-- For now, keep the permissive policy since frontend handles access control
-- This allows the admin interface to work properly
CREATE POLICY "Allow admin modifications" 
  ON public.actor_spec_categories 
  FOR ALL 
  USING (true)
  WITH CHECK (true);

