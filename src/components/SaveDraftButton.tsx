
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Save } from 'lucide-react';
import { useDraftOperations } from '@/hooks/useDraftOperations';
import { useToast } from '@/hooks/use-toast';

interface SaveDraftButtonProps {
  draftData: {
    theme: string;
    option: string;
    participants: string[];
    categories: string[];
    picks: any[];
    isComplete: boolean;
  };
}

const SaveDraftButton = ({ draftData }: SaveDraftButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const { saveDraft } = useDraftOperations();
  const { toast } = useToast();

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title for your draft",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      await saveDraft({
        title: title.trim(),
        ...draftData
      });
      
      toast({
        title: "Success",
        description: "Draft saved successfully!"
      });
      
      setIsOpen(false);
      setTitle('');
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-gray-600 text-gray-300 hover:bg-gray-700"
        >
          <Save size={16} className="mr-2" />
          Save Draft
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-800 border-gray-600">
        <DialogHeader>
          <DialogTitle className="text-white">Save Draft</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-300 mb-2 block">
              Draft Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a name for your draft..."
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="border-gray-600 text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-yellow-400 text-black hover:bg-yellow-500"
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SaveDraftButton;
