
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useProfileFixer = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const fixMyParticipantNames = useCallback(async () => {
    if (!user) return;

    try {
      // Get user's profile name
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.name) {
        console.log('No profile name found to fix with');
        return;
      }

      // Find participant records where the name is the user's email
      const { data: participantsToFix, error: fetchError } = await supabase
        .from('draft_participants')
        .select('id, participant_name')
        .eq('user_id', user.id)
        .eq('participant_name', user.email);

      if (fetchError) {
        console.error('Error fetching participants to fix:', fetchError);
        return;
      }

      if (!participantsToFix || participantsToFix.length === 0) {
        console.log('No participant records need fixing');
        return;
      }

      console.log(`Found ${participantsToFix.length} participant records to fix`);

      // Update all participant records to use the profile name
      const { error: updateError } = await supabase
        .from('draft_participants')
        .update({ participant_name: profile.name })
        .eq('user_id', user.id)
        .eq('participant_name', user.email);

      if (updateError) {
        console.error('Error fixing participant names:', updateError);
        toast({
          title: "Error",
          description: "Failed to update your name in existing drafts",
          variant: "destructive",
        });
      } else {
        console.log(`Successfully fixed ${participantsToFix.length} participant records`);
        toast({
          title: "Names Updated",
          description: `Fixed your name in ${participantsToFix.length} existing draft(s)`,
        });
      }
    } catch (error) {
      console.error('Error in fixMyParticipantNames:', error);
    }
  }, [user, toast]);

  return { fixMyParticipantNames };
};
