
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { useDraftOperations } from '@/hooks/useDraftOperations';
import { useToast } from '@/hooks/use-toast';
import { Participant } from '@/types/participant';

interface SaveDraftButtonProps {
  draftData: {
    title?: string;
    theme: string;
    option: string;
    participants: string[] | Participant[];
    categories: string[];
    picks: any[];
    isComplete: boolean;
  };
}

const SaveDraftButton = ({ draftData }: SaveDraftButtonProps) => {
  const [saving, setSaving] = useState(false);
  const { saveDraft } = useDraftOperations();
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      // Generate a default title with timestamp
      const now = new Date();
      const defaultTitle = `Copy of ${draftData.title || 'Draft'} - ${now.toLocaleDateString()}`;
      
      await saveDraft({
        title: defaultTitle,
        ...draftData
      });
      
      toast({
        title: "Success",
        description: "Draft saved successfully!"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save draft. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button
      onClick={handleSave}
      disabled={saving}
      variant="outline"
      className="border-gray-600 text-gray-300 hover:bg-gray-700 w-full md:w-auto !h-auto"
      style={{
        fontSize: '16px',
        fontFamily: 'Brockmann',
        fontWeight: '600',
        lineHeight: '24px',
        letterSpacing: '0.32px',
        alignSelf: 'stretch',
        height: 'auto'
      }}
    >
      <Save size={16} className="mr-2" />
      {saving ? 'Saving...' : 'Save Draft'}
    </Button>
  );
};

export default SaveDraftButton;
