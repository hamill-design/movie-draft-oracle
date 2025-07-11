import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMultiplayerDraft } from '@/hooks/useMultiplayerDraft';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { MultiplayerDraftGame } from './MultiplayerDraftGame';

interface MultiplayerDraftInterfaceProps {
  draftId?: string;
  initialData?: {
    theme: string;
    option: string;
    participants: string[];
    categories: string[];
    isHost?: boolean;
  };
}

export const MultiplayerDraftInterface = ({ draftId, initialData }: MultiplayerDraftInterfaceProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const { createMultiplayerDraft } = useMultiplayerDraft();

  // Create draft if this is a new multiplayer draft
  useEffect(() => {
    if (initialData && !draftId && user) {
      const createDraft = async () => {
        try {
          const newDraft = await createMultiplayerDraft({
            title: `${initialData.theme} Draft - ${new Date().toLocaleDateString()}`,
            theme: initialData.theme,
            option: initialData.option,
            categories: initialData.categories,
            participantEmails: initialData.participants,
          });
          
          // Navigate to the draft page with the new draft ID
          navigate(`/draft?id=${newDraft.id}`, { replace: true });
        } catch (error) {
          console.error('Failed to create draft:', error);
          toast({
            title: "Error",
            description: "Failed to create multiplayer draft",
            variant: "destructive",
          });
        }
      };

      createDraft();
    }
  }, [initialData, draftId, user, createMultiplayerDraft, navigate, toast]);

  // If we have a draftId, render the game
  if (draftId) {
    return <MultiplayerDraftGame draftId={draftId} />;
  }

  // Loading state while creating a new draft
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Creating multiplayer draft...</p>
      </div>
    </div>
  );
};