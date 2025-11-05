-- Add name column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN name TEXT;

-- Update the handle_new_user function to extract name from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    new.id, 
    new.email,
    new.raw_user_meta_data ->> 'name'
  );
  RETURN new;
END;
$$;