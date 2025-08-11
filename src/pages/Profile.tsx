
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

        <div className="w-full h-full p-6 bg-greyscale-blue-100 shadow-[0px_0px_3px_rgba(0,0,0,0.25)] rounded flex-col justify-start items-start gap-3 inline-flex mb-8">
          <div className="flex-col justify-start items-start flex">
            <div className="justify-center flex flex-col text-text-primary text-2xl font-brockmann font-bold leading-8 tracking-[0.96px]">
              Account Information
            </div>
          </div>
          <div className="self-stretch justify-start items-center gap-4 inline-flex flex-wrap content-center">
            <div className="flex-1 min-w-[300px] justify-start items-center gap-1.5 flex">
              <div className="justify-center flex flex-col text-greyscale-blue-600 text-base font-brockmann font-semibold leading-6 tracking-[0.32px]">
                Name:
              </div>
              <div className="flex-col justify-start items-start inline-flex">
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
                  <div className="justify-center flex flex-col text-greyscale-blue-600 text-base font-brockmann font-normal leading-6">
                    {profile?.name || 'No name set'}
                  </div>
                )}
              </div>
              {!isEditingName && (
                <div 
                  onClick={() => setIsEditingName(true)}
                  className="p-1 rounded-md justify-center items-center flex cursor-pointer hover:bg-greyscale-blue-200"
                >
                  <div className="w-4 h-4 relative">
                    <Edit3 size={16} className="text-greyscale-blue-600" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-[300px] justify-start items-center gap-1.5 flex">
              <div className="justify-center flex flex-col">
                <span className="text-greyscale-blue-600 text-base font-brockmann font-bold leading-6">Email:</span>
                <span className="text-greyscale-blue-600 text-base font-brockmann font-normal leading-6"> </span>
              </div>
              <div className="justify-center flex flex-col text-greyscale-blue-600 text-base font-brockmann font-normal leading-6">
                {user.email}
              </div>
            </div>
            <div className="flex-1 min-w-[300px] justify-start items-start gap-1.5 flex">
              <div className="justify-center flex flex-col">
                <span className="text-greyscale-blue-600 text-base font-brockmann font-bold leading-6">Total Drafts:</span>
                <span className="text-greyscale-blue-600 text-base font-brockmann font-normal leading-6"> </span>
              </div>
              <div className="justify-center flex flex-col text-greyscale-blue-600 text-base font-brockmann font-normal leading-6">
                {drafts.length}
              </div>
            </div>
          </div>
        </div>

        {/* Saved Drafts */}
        <div className="w-full h-full p-6 bg-greyscale-blue-100 shadow-[0px_0px_3px_rgba(0,0,0,0.25)] rounded flex-col justify-start items-start gap-3 inline-flex">
          <div className="flex-col justify-start items-start flex">
            <div className="justify-center flex flex-col text-text-primary text-2xl font-brockmann font-bold leading-8 tracking-[0.96px]">
              Saved Drafts
            </div>
          </div>
          <div className="self-stretch flex-col justify-start items-start gap-4 flex">
            {drafts.length === 0 ? (
              <div className="self-stretch py-8 text-center text-greyscale-blue-500 text-base font-brockmann font-normal leading-6">
                No saved drafts yet. Start a new draft to see it here!
              </div>
            ) : (
              <div className="self-stretch flex-col justify-start items-start gap-4 flex">
                {drafts.map((draft, index) => (
                  <div key={draft.id}>
                    <div className="w-full h-full p-6 bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-lg border border-greyscale-blue-200 justify-between items-center inline-flex flex-wrap relative">
                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteDraft(draft.id)}
                        className="absolute top-4 right-4 p-2 rounded hover:bg-greyscale-blue-100 text-greyscale-blue-600 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                      
                      <div className="flex-1 min-w-[240px] flex-col justify-start items-start gap-4 inline-flex pr-16">
                        {/* Header with image and title */}
                        <div className="justify-start items-start gap-3 inline-flex">
                          <div className="w-14 h-14 rounded border border-greyscale-blue-200 flex items-center justify-center bg-greyscale-blue-50">
                            {draft.theme === 'year' ? (
                              <Calendar size={24} className="text-greyscale-blue-500" />
                            ) : draft.theme === 'people' ? (
                              <DraftActorPortrait 
                                actorName={getCleanActorName(draft.option)}
                                size="md"
                              />
                            ) : (
                              <User size={24} className="text-greyscale-blue-500" />
                            )}
                          </div>
                          <div className="flex-col justify-start items-start gap-2 inline-flex">
                            <div className="flex-col justify-start items-start flex">
                              <div className="text-greyscale-blue-800 text-lg font-brockmann font-semibold leading-6">
                                {draft.theme === 'people' ? getCleanActorName(draft.option) : draft.option}
                              </div>
                            </div>
                            <div className="justify-start items-start gap-2 inline-flex flex-wrap">
                              <div className={`px-3 py-1 rounded-full border-0.5 ${
                                draft.is_multiplayer 
                                  ? 'bg-teal-100 border-teal-800' 
                                  : 'bg-purple-100 border-purple-700'
                              } justify-start items-center flex`}>
                                <span className={`text-xs font-brockmann font-semibold leading-4 ${
                                  draft.is_multiplayer 
                                    ? 'text-teal-800' 
                                    : 'text-purple-700'
                                }`}>
                                  {draft.is_multiplayer ? 'Multiplayer' : 'Local'}
                                </span>
                              </div>
                              {draft.is_complete && (
                                <div className="px-3 py-1 bg-teal-600 rounded-full justify-start items-center flex">
                                  <span className="text-white text-xs font-brockmann font-semibold leading-4">
                                    Complete
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Details */}
                        <div className="self-stretch justify-start items-center gap-4 inline-flex flex-wrap">
                          <div className="justify-start items-center gap-1 flex">
                            <div className="w-4 h-4 relative flex items-center justify-center">
                              <Calendar size={13} className="text-greyscale-blue-500" />
                            </div>
                            <span className="text-greyscale-blue-500 text-sm font-brockmann font-medium leading-5">
                              {new Date(draft.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="justify-start items-center gap-1 flex">
                            <div className="w-4 h-4 relative flex items-center justify-center">
                              <Users size={13} className="text-greyscale-blue-500" />
                            </div>
                            <span className="text-greyscale-blue-500 text-sm font-brockmann font-medium leading-5">
                              {draft.participants.length} players
                            </span>
                          </div>
                          <div className="justify-start items-center gap-1 flex">
                            <div className="w-4 h-4 relative flex items-center justify-center">
                              <Trophy size={13} className="text-greyscale-blue-500" />
                            </div>
                            <span className="text-greyscale-blue-500 text-sm font-brockmann font-medium leading-5">
                              {draft.categories.length} categories
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Button */}
                      <div className="flex-col justify-start items-end gap-4 inline-flex">
                        <button
                          onClick={() => handleViewDraft(draft)}
                          className="self-stretch px-4 py-2 bg-brand-primary rounded justify-center items-center inline-flex hover:bg-purple-700 transition-colors"
                        >
                          <span className="text-white text-sm font-brockmann font-medium leading-5">
                            {draft.is_complete ? 'View Draft' : 'Continue Draft'}
                          </span>
                        </button>
                      </div>
                    </div>
                    
                    {/* Inline Ad after every 3 drafts - Hidden for now */}
                    {/* {index > 0 && (index + 1) % 3 === 0 && <InlineAd />} */}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
