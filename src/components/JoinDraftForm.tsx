
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { HeaderIcon3 } from './HeaderIcon3';
import { SearchIcon } from '@/components/icons';

export const JoinDraftForm = () => {
  const [draftCode, setDraftCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleJoinDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!draftCode.trim()) {
      toast({
        title: "Draft code required",
        description: "Please enter a draft code to join",
        variant: "destructive",
      });
      return;
    }

    setIsJoining(true);

    try {
      // First check if the draft exists and is active
      const { data: draft, error } = await supabase
        .from('drafts')
        .select('id, status, current_turn, total_rounds')
        .eq('invite_code', draftCode.trim())
        .single();

      if (error) {
        toast({
          title: "Draft not found",
          description: "Please check your draft code and try again",
          variant: "destructive",
        });
        return;
      }

      if (draft.status === 'completed') {
        toast({
          title: "Draft completed",
          description: "This draft has already finished",
          variant: "destructive",
        });
        return;
      }

      // Navigate to the join page with the draft code
      navigate(`/join/${draftCode.trim()}`);
      
    } catch (error) {
      console.error('Error joining draft:', error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <Card className="bg-background">
      <CardContent className="pt-6">
        <form onSubmit={handleJoinDraft} className="space-y-4">
          <HeaderIcon3 
            title="Join an Existing Draft" 
            icon={<SearchIcon className="w-6 h-6 text-primary" />} 
          />
          
          <div className="flex gap-2">
            <Input
              placeholder="Enter draft code..."
              value={draftCode}
              onChange={(e) => setDraftCode(e.target.value)}
              className="flex-1 rounded-[2px]"
            />
            <Button 
              type="submit" 
              disabled={isJoining}
              className="bg-[#680AFF] hover:bg-[#5A08E6] text-white font-brockmann font-medium px-6"
            >
              {isJoining ? 'Joining...' : 'Join'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
