import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, User, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DraftModeSelectorProps {
  onModeSelect: (mode: 'single' | 'multiplayer', inviteCode?: string) => void;
}

export const DraftModeSelector = ({ onModeSelect }: DraftModeSelectorProps) => {
  const [selectedMode, setSelectedMode] = useState<'single' | 'multiplayer' | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [participantName, setParticipantName] = useState('');
  const { toast } = useToast();

  const handleSinglePlayer = () => {
    setSelectedMode('single');
    onModeSelect('single');
  };

  const handleMultiplayerHost = () => {
    setSelectedMode('multiplayer');
    onModeSelect('multiplayer');
  };

  const handleJoinDraft = () => {
    if (!inviteCode.trim() || !participantName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both invite code and your name",
        variant: "destructive",
      });
      return;
    }
    
    onModeSelect('multiplayer', inviteCode.trim());
  };

  if (selectedMode) {
    return null; // Hide the selector once mode is chosen
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2">Choose Draft Mode</h2>
        <p className="text-muted-foreground">
          Play solo or collaborate with friends in real-time
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Single Player Mode */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
              <User className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl">Single Player</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Draft by yourself, perfect for testing strategies or solo entertainment
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Quick setup</li>
              <li>• Practice draft strategies</li>
              <li>• No waiting for others</li>
            </ul>
            <Button 
              onClick={handleSinglePlayer}
              className="w-full"
              size="lg"
            >
              Start Solo Draft
            </Button>
          </CardContent>
        </Card>

        {/* Multiplayer Mode */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl">Multiplayer</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Draft with friends in real-time from different devices
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Real-time collaboration</li>
              <li>• Turn-based picking</li>
              <li>• Share with invite codes</li>
            </ul>
            
            <div className="space-y-3">
              <Button 
                onClick={handleMultiplayerHost}
                className="w-full"
                size="lg"
              >
                Host New Draft
              </Button>
              
              <div className="text-sm text-muted-foreground">or</div>
              
              <div className="space-y-2">
                <div className="space-y-2">
                  <Label htmlFor="participantName" className="text-left block">Your Name</Label>
                  <Input
                    id="participantName"
                    placeholder="Enter your name"
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inviteCode" className="text-left block">Invite Code</Label>
                  <Input
                    id="inviteCode"
                    placeholder="Enter invite code"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    maxLength={8}
                  />
                </div>
                <Button 
                  onClick={handleJoinDraft}
                  variant="outline"
                  className="w-full"
                  disabled={!inviteCode.trim() || !participantName.trim()}
                >
                  Join Draft
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};