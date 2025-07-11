-- Fix RLS policy for drafts to allow participants to update
DROP POLICY IF EXISTS "Users can update their own drafts" ON public.drafts;

CREATE POLICY "Users can update drafts they participate in"
ON public.drafts
FOR UPDATE
USING (
  (auth.uid() = user_id) 
  OR 
  public.is_draft_participant(id)
);

-- Remove the problematic foreign key constraint
ALTER TABLE public.drafts DROP CONSTRAINT IF EXISTS drafts_current_turn_user_id_fkey;

-- Create atomic pick function
CREATE OR REPLACE FUNCTION public.make_multiplayer_pick(
  p_draft_id UUID,
  p_movie_id INTEGER,
  p_movie_title TEXT,
  p_movie_year INTEGER,
  p_movie_genre TEXT,
  p_category TEXT,
  p_poster_path TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  new_pick_number INTEGER,
  next_turn_user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_pick_number INTEGER;
  v_turn_order JSONB;
  v_next_turn_info JSONB;
  v_next_user_id UUID;
  v_is_complete BOOLEAN := false;
  v_total_picks INTEGER;
  v_participant_count INTEGER;
  v_categories_count INTEGER;
BEGIN
  -- Get current draft state
  SELECT 
    current_pick_number, 
    turn_order,
    array_length(categories, 1)
  INTO 
    v_current_pick_number, 
    v_turn_order,
    v_categories_count
  FROM public.drafts 
  WHERE id = p_draft_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Draft not found'::TEXT, 0, NULL::UUID;
    RETURN;
  END IF;

  -- Verify it's the user's turn
  SELECT (turn_order_item->>'user_id')::UUID
  INTO v_next_user_id
  FROM public.drafts,
       jsonb_array_elements(turn_order) AS turn_order_item
  WHERE id = p_draft_id
    AND (turn_order_item->>'pick_number')::INTEGER = v_current_pick_number;

  IF v_next_user_id != auth.uid() THEN
    RETURN QUERY SELECT false, 'Not your turn'::TEXT, v_current_pick_number, v_next_user_id;
    RETURN;
  END IF;

  -- Insert the pick
  INSERT INTO public.draft_picks (
    draft_id,
    player_id,
    player_name,
    movie_id,
    movie_title,
    movie_year,
    movie_genre,
    category,
    pick_order,
    poster_path
  )
  SELECT 
    p_draft_id,
    1, -- placeholder player_id
    COALESCE(dp.participant_name, 'Unknown Player'),
    p_movie_id,
    p_movie_title,
    p_movie_year,
    p_movie_genre,
    p_category,
    v_current_pick_number,
    p_poster_path
  FROM public.draft_participants dp
  WHERE dp.draft_id = p_draft_id 
    AND dp.user_id = auth.uid();

  -- Calculate next turn
  v_current_pick_number := v_current_pick_number + 1;
  
  -- Get participant count to determine total picks
  SELECT COUNT(*) INTO v_participant_count
  FROM public.draft_participants
  WHERE draft_id = p_draft_id;
  
  v_total_picks := v_participant_count * v_categories_count;

  -- Check if draft is complete
  IF v_current_pick_number > v_total_picks THEN
    v_is_complete := true;
    v_next_user_id := NULL;
  ELSE
    -- Find next turn user
    SELECT (turn_order_item->>'user_id')::UUID
    INTO v_next_user_id
    FROM public.drafts,
         jsonb_array_elements(turn_order) AS turn_order_item
    WHERE id = p_draft_id
      AND (turn_order_item->>'pick_number')::INTEGER = v_current_pick_number;
  END IF;

  -- Update draft state
  UPDATE public.drafts 
  SET 
    current_pick_number = v_current_pick_number,
    current_turn_user_id = v_next_user_id,
    is_complete = v_is_complete,
    updated_at = now()
  WHERE id = p_draft_id;

  -- Return success
  RETURN QUERY SELECT true, 'Pick successful'::TEXT, v_current_pick_number, v_next_user_id;
END;
$$;