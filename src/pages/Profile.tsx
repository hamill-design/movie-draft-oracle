
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
                    <Card className="bg-gray-700 border-gray-600 relative">
                      <Button
                        onClick={() => handleDeleteDraft(draft.id)}
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 p-1 h-8 w-8"
                      >
                        <Trash2 size={14} />
                      </Button>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              {draft.theme === 'year' ? (
                                <Calendar size={20} className="text-yellow-400" />
                              ) : draft.theme === 'people' ? (
                                <DraftActorPortrait 
                                  actorName={getCleanActorName(draft.option)}
                                  size="md"
                                />
                              ) : (
                                <User size={20} className="text-yellow-400" />
                              )}
                              <h3 className="text-white font-semibold text-lg">
                                {draft.theme === 'people' ? getCleanActorName(draft.option) : draft.option}
                              </h3>
                            </div>
                            <div className="mb-2">
                              {draft.is_multiplayer ? (
                                <Badge variant="default">Multiplayer</Badge>
                              ) : (
                                <div data-property-1="Variant2" style={{width: '100%', height: '100%', paddingLeft: '12px', paddingRight: '12px', paddingTop: '4px', paddingBottom: '4px', background: 'var(--Purple-100, #EDEBFF)', borderRadius: '9999px', outline: '0.50px var(--Purple-700, #3B0394) solid', outlineOffset: '-0.50px', justifyContent: 'flex-start', alignItems: 'center', display: 'inline-flex'}}>
                                  <div style={{justifyContent: 'center', display: 'flex', flexDirection: 'column', color: 'var(--Purple-700, #3B0394)', fontSize: '12px', fontFamily: 'Brockmann', fontWeight: '600', lineHeight: '16px', wordWrap: 'break-word'}}>Local</div>
                                </div>
                              )}
                              {draft.is_complete && (
                                <Badge variant="secondary" className="ml-2 bg-green-600 text-white">
                                  Complete
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-300">
                              <div className="flex items-center gap-1">
                                <Calendar size={14} />
                                {new Date(draft.created_at).toLocaleDateString()}
                              </div>
                              <div className="flex items-center gap-1">
                                <Users size={14} />
                                {draft.participants.length} players
                              </div>
                              <div className="flex items-center gap-1">
                                <Trophy size={14} />
                                {draft.categories.length} categories
                              </div>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleViewDraft(draft)}
                            className="bg-yellow-400 text-black hover:bg-yellow-500"
                          >
                            {draft.is_complete ? 'View Draft' : 'Continue Draft'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    
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
