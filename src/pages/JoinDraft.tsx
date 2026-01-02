import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMultiplayerDraft } from '@/hooks/useMultiplayerDraft';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Users, Mail, Hash } from 'lucide-react';

export const JoinDraft = () => {
  const { draftId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { joinDraftByCode, loading } = useMultiplayerDraft();

  const [inviteCode, setInviteCode] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [isEmailInvite, setIsEmailInvite] = useState(false);
  const [isAutoJoining, setIsAutoJoining] = useState(false);

  const invitedEmail = searchParams.get('email');
  const autoJoin = searchParams.get('auto') === 'true';

  useEffect(() => {
    // Check if this is an email invitation
    if (draftId && invitedEmail) {
      setIsEmailInvite(true);
      setParticipantName(invitedEmail);
    }
    
    // Pre-fill participant name with user email if available
    if (user?.email && !participantName) {
      setParticipantName(user.email);
    }
  }, [draftId, invitedEmail, user?.email, participantName]);

  // Auto-join effect for email invitations
  useEffect(() => {
    if (autoJoin && draftId && user && invitedEmail && !isAutoJoining) {
      handleAutoJoin();
    }
  }, [autoJoin, draftId, user, invitedEmail, isAutoJoining]);

  const handleAutoJoin = async () => {
    if (!draftId || !invitedEmail || !user) return;
    
    setIsAutoJoining(true);
    
    try {
      // Get the invite code from the draft
      const { data: draftData, error } = await supabase
        .from('drafts')
        .select('invite_code')
        .eq('id', draftId)
        .single();

      if (error || !draftData?.invite_code) {
        throw new Error('Invalid or expired invitation');
      }

      await joinDraftByCode(draftData.invite_code, invitedEmail);
    } catch (error) {
      console.error('Auto-join failed:', error);
      toast({
        title: "Auto-join Failed",
        description: "Unable to automatically join the draft. Please try manually.",
        variant: "destructive",
      });
      setIsAutoJoining(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteCode.trim() || !participantName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both invite code and your name",
        variant: "destructive",
      });
      return;
    }

    try {
      await joinDraftByCode(inviteCode.trim().toUpperCase(), participantName.trim());
    } catch (error) {
      console.error('Failed to join draft:', error);
    }
  };

  const handleJoinByEmailInvite = async () => {
    if (!draftId || !participantName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter your name to join",
        variant: "destructive",
      });
      return;
    }

    try {
      // For email invites, we need to get the invite code from the draft
      // and then use the normal join flow
      const { data: draftData, error } = await supabase
        .from('drafts')
        .select('invite_code')
        .eq('id', draftId)
        .single();

      if (error || !draftData?.invite_code) {
        throw new Error('Invalid or expired invitation');
      }

      await joinDraftByCode(draftData.invite_code, participantName.trim());
    } catch (error) {
      console.error('Failed to join draft via email:', error);
      toast({
        title: "Error",
        description: "Failed to join draft. The invitation may be invalid or expired.",
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Sign In Required</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              You need to sign in to join a draft
            </p>
            <Button onClick={() => navigate('/auth')}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show auto-joining state
  if (isAutoJoining) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Users className="h-6 w-6" />
              Joining Draft
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
            <p className="text-muted-foreground">
              Automatically joining the draft...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Movie Drafter - Join Draft</title>
        <meta name="description" content="Join an existing movie draft by entering an invite code or following an invitation link. Compete with friends and see who picks the best movies." />
        <meta property="og:title" content="Movie Drafter - Join Draft" />
        <meta property="og:description" content="Join an existing movie draft by entering an invite code or following an invitation link. Compete with friends and see who picks the best movies." />
        <meta property="og:url" content={`https://moviedrafter.com/join-draft${draftId ? `/${draftId}` : ''}`} />
        <meta property="og:image" content="https://moviedrafter.com/og-image.jpg" />
        <meta name="twitter:title" content="Movie Drafter - Join Draft" />
        <meta name="twitter:description" content="Join an existing movie draft by entering an invite code or following an invitation link. Compete with friends and see who picks the best movies." />
        <meta name="twitter:image" content="https://moviedrafter.com/og-image.jpg" />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
        <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Users className="h-6 w-6" />
            Join Draft
          </CardTitle>
          <p className="text-muted-foreground">
            Join a multiplayer movie draft session
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {isEmailInvite && !autoJoin ? (
            // Email invitation flow
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                Email Invitation
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Invited Email</Label>
                <Input
                  id="email"
                  value={invitedEmail || ''}
                  disabled
                  className="bg-muted"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">Your Display Name</Label>
                <Input
                  id="name"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>
              
              <Button 
                onClick={handleJoinByEmailInvite}
                disabled={loading || !participantName.trim()}
                className="w-full"
              >
                {loading ? 'Joining...' : 'Join Draft'}
              </Button>
            </div>
          ) : (
            // Invite code flow
            <form onSubmit={handleJoinByCode} className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Hash className="h-4 w-4" />
                Invite Code
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="code">Invite Code</Label>
                <Input
                  id="code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Enter 8-character code"
                  maxLength={8}
                  className="font-mono tracking-wider text-center"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">Your Display Name</Label>
                <Input
                  id="name"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>
              
              <Button 
                type="submit"
                disabled={loading || !inviteCode.trim() || !participantName.trim()}
                className="w-full"
              >
                {loading ? 'Joining...' : 'Join Draft'}
              </Button>
            </form>
          )}
          
          <Separator />
          
          <div className="text-center">
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="w-full"
            >
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
};