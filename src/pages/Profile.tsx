
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Calendar, Users, Trophy, Trash2, User, Edit3, Save, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useDrafts } from '@/hooks/useDrafts';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import BannerAd from '@/components/ads/BannerAd';
import InlineAd from '@/components/ads/InlineAd';
import { DraftActorPortrait } from '@/components/DraftActorPortrait';
import { getCleanActorName } from '@/lib/utils';

const Profile = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { drafts, loading: draftsLoading, refetch } = useDrafts();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        
        if (!error && data) {
          setProfile(data);
          setNewName(data.name || '');
        }
      }
    };

    fetchProfile();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleViewDraft = async (draft: any) => {
    navigate('/draft', {
      state: {
        theme: draft.theme,
        option: draft.option,
        participants: draft.participants,
        categories: draft.categories,
        existingDraftId: draft.id,
        isMultiplayer: draft.is_multiplayer
      }
    });
  };

  const handleDeleteDraft = async (draftId: string) => {
    try {
      const { error } = await supabase
        .from('drafts')
        .delete()
        .eq('id', draftId);

      if (error) throw error;

      toast({
        title: "Draft deleted",
        description: "Your draft has been successfully deleted.",
      });

      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete draft. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSaveName = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: newName.trim() })
        .eq('id', user?.id);

      if (error) throw error;

      setProfile({ ...profile, name: newName.trim() });
      setIsEditingName(false);

      toast({
        title: "Name updated",
        description: "Your display name has been successfully updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update name. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setNewName(profile?.name || '');
    setIsEditingName(false);
  };

  if (loading || draftsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(118deg, #FCFFFF -8.18%, #F0F1FF 53.14%, #FCFFFF 113.29%)'}}>
        <div className="text-text-primary text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen" style={{background: 'linear-gradient(118deg, #FCFFFF -8.18%, #F0F1FF 53.14%, #FCFFFF 113.29%)'}}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="w-full h-full justify-between items-center inline-flex mb-8">
          <div className="justify-start items-center gap-4 flex">
            <div className="flex-col justify-start items-start inline-flex">
              <div className="justify-center flex flex-col text-greyscale-blue-900 text-5xl font-chaney font-normal leading-[52px] tracking-[1.92px]">
                Profile
              </div>
            </div>
          </div>
          <div 
            onClick={handleSignOut}
            className="px-4 py-2 bg-purple-150 rounded-[2px] justify-center items-center flex cursor-pointer hover:bg-purple-200 transition-colors"
          >
            <div className="text-center justify-center flex flex-col text-text-primary text-sm font-brockmann font-medium leading-5">
              Sign Out
            </div>
          </div>
        </div>

        {/* Banner Ad - Hidden for now */}
        {/* <BannerAd className="mb-8" /> */}

        {/* User Info */}
        <Card className="bg-gray-800 border-gray-600 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-gray-300 mb-2">
                  <strong>Name:</strong>
                </p>
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                      placeholder="Enter your name"
                    />
                    <Button
                      onClick={handleSaveName}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Save size={16} />
                    </Button>
                    <Button
                      onClick={handleCancelEdit}
                      size="sm"
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      <X size={16} />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300">
                      {profile?.name || 'No name set'}
                    </span>
                    <Button
                      onClick={() => setIsEditingName(true)}
                      size="sm"
                      variant="ghost"
                      className="text-gray-400 hover:text-gray-300"
                    >
                      <Edit3 size={16} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            
            <p className="text-gray-300">
              <strong>Email:</strong> {user.email}
            </p>
            <p className="text-gray-300">
              <strong>Total Drafts:</strong> {drafts.length}
            </p>
          </CardContent>
        </Card>

        {/* Saved Drafts */}
        <Card className="bg-gray-800 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white">Saved Drafts</CardTitle>
          </CardHeader>
          <CardContent>
            {drafts.length === 0 ? (
              <p className="text-gray-400 text-center py-8">
                No saved drafts yet. Start a new draft to see it here!
              </p>
            ) : (
              <div className="grid gap-4">
                {drafts.map((draft, index) => (
                  <div key={draft.id}>
                    <div style={{width: '100%', height: '100%', padding: 24, background: 'var(--UI-Primary, white)', boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)', borderRadius: 8, outline: '1px var(--Greyscale-(Blue)-200, #D9E0DF) solid', outlineOffset: '-1px', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex', flexWrap: 'wrap', alignContent: 'center'}}>
                      <div style={{flex: '1 1 0', minWidth: 240, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 16, display: 'inline-flex'}}>
                        <div style={{justifyContent: 'flex-start', alignItems: 'flex-start', gap: 12, display: 'inline-flex'}}>
                          {draft.theme === 'people' ? (
                            <div style={{width: 56, alignSelf: 'stretch', borderRadius: 4, overflow: 'hidden'}}>
                              <DraftActorPortrait 
                                actorName={getCleanActorName(draft.option)}
                                size="lg"
                              />
                            </div>
                          ) : (
                            <div style={{width: 56, height: 56, borderRadius: 4, background: 'var(--Greyscale-(Blue)-200, #D9E0DF)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                              {draft.theme === 'year' ? (
                                <Calendar size={24} style={{color: 'var(--Greyscale-(Blue)-500, #828786)'}} />
                              ) : (
                                <User size={24} style={{color: 'var(--Greyscale-(Blue)-500, #828786)'}} />
                              )}
                            </div>
                          )}
                          <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8, display: 'inline-flex'}}>
                            <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex'}}>
                              <div style={{justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Greyscale-(Blue)-800, #2B2D2D)', fontSize: 18, fontFamily: 'Brockmann', fontWeight: '600', lineHeight: 24, wordWrap: 'break-word'}}>
                                {draft.theme === 'people' ? getCleanActorName(draft.option) : draft.option}
                              </div>
                            </div>
                            <div style={{alignSelf: 'stretch', height: 24, justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8, display: 'inline-flex', flexWrap: 'wrap', alignContent: 'flex-start'}}>
                              <div style={{paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, background: draft.is_multiplayer ? 'var(--Teal-100, #EBFFFA)' : 'var(--Purple-100, #EDEBFF)', borderRadius: 9999, outline: `0.50px ${draft.is_multiplayer ? 'var(--Teal-800, #015E45)' : 'var(--Purple-700, #3B0394)'} solid`, outlineOffset: '-0.50px', justifyContent: 'flex-start', alignItems: 'center', display: 'flex'}}>
                                <div style={{justifyContent: 'center', display: 'flex', flexDirection: 'column', color: draft.is_multiplayer ? 'var(--Teal-800, #015E45)' : 'var(--Purple-700, #3B0394)', fontSize: 12, fontFamily: 'Brockmann', fontWeight: '600', lineHeight: 16, wordWrap: 'break-word'}}>
                                  {draft.is_multiplayer ? 'Multiplayer' : 'Local'}
                                </div>
                              </div>
                              {draft.is_complete && (
                                <div style={{paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, background: 'var(--Teal-600, #06C995)', borderRadius: 9999, justifyContent: 'flex-start', alignItems: 'center', display: 'flex'}}>
                                  <div style={{justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--UI-Primary, white)', fontSize: 12, fontFamily: 'Brockmann', fontWeight: '600', lineHeight: 16, wordWrap: 'break-word'}}>Complete</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{alignSelf: 'stretch', justifyContent: 'flex-start', alignItems: 'center', gap: 16, display: 'inline-flex', flexWrap: 'wrap', alignContent: 'center'}}>
                          <div style={{justifyContent: 'flex-start', alignItems: 'center', gap: 4, display: 'flex'}}>
                            <Calendar size={16} style={{color: 'var(--Greyscale-(Blue)-500, #828786)'}} />
                            <div style={{justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Greyscale-(Blue)-500, #828786)', fontSize: 14, fontFamily: 'Brockmann', fontWeight: '500', lineHeight: 20, wordWrap: 'break-word'}}>
                              {new Date(draft.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div style={{justifyContent: 'flex-start', alignItems: 'center', gap: 4, display: 'flex'}}>
                            <Users size={16} style={{color: 'var(--Greyscale-(Blue)-500, #828786)'}} />
                            <div style={{justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Greyscale-(Blue)-500, #828786)', fontSize: 14, fontFamily: 'Brockmann', fontWeight: '500', lineHeight: 20, wordWrap: 'break-word'}}>
                              {draft.participants.length} players
                            </div>
                          </div>
                          <div style={{justifyContent: 'flex-start', alignItems: 'center', gap: 4, display: 'flex'}}>
                            <Trophy size={16} style={{color: 'var(--Greyscale-(Blue)-500, #828786)'}} />
                            <div style={{justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Greyscale-(Blue)-500, #828786)', fontSize: 14, fontFamily: 'Brockmann', fontWeight: '500', lineHeight: 20, wordWrap: 'break-word'}}>
                              {draft.categories.length} categories
                            </div>
                          </div>
                        </div>
                      </div>
                      <div style={{flex: '1 1 0', maxWidth: 360, minWidth: 240, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-end', gap: 16, display: 'inline-flex'}}>
                        <div 
                          onClick={() => handleViewDraft(draft)}
                          style={{alignSelf: 'stretch', paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, background: 'var(--Brand-Primary, #680AFF)', borderRadius: 2, justifyContent: 'center', alignItems: 'center', display: 'inline-flex', cursor: 'pointer'}}
                        >
                          <div style={{textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--UI-Primary, white)', fontSize: 14, fontFamily: 'Brockmann', fontWeight: '500', lineHeight: 20, wordWrap: 'break-word'}}>
                            {draft.is_complete ? 'View Draft' : 'Continue Draft'}
                          </div>
                        </div>
                        <div 
                          onClick={() => handleDeleteDraft(draft.id)}
                          style={{paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 2, justifyContent: 'center', alignItems: 'center', gap: 8, display: 'inline-flex', cursor: 'pointer'}}
                        >
                          <Trash2 size={16} style={{color: 'var(--Greyscale-(Blue)-600, #646968)'}} />
                          <div style={{textAlign: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Greyscale-(Blue)-600, #646968)', fontSize: 14, fontFamily: 'Brockmann', fontWeight: '500', lineHeight: 20, wordWrap: 'break-word'}}>Delete</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Inline Ad after every 3 drafts - Hidden for now */}
                    {/* {index > 0 && (index + 1) % 3 === 0 && <InlineAd />} */}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
