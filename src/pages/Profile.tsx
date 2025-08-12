
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
          <div className="pt-6 w-full">
            {drafts.length === 0 ? (
              <p className="text-greyscale-blue-600 text-center py-8 font-brockmann">
                No saved drafts yet. Start a new draft to see it here!
              </p>
            ) : (
              <div className="grid gap-4 w-full">
                {drafts.map((draft, index) => (
                  <div key={draft.id} className="w-full">
                    {/* New Draft Card Design */}
                    <div className="w-full p-6 bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-lg border border-[#D9E0DF] flex justify-between items-center flex-wrap">
                      {/* Left Container */}
                      <div className="flex-1 min-w-[240px] flex-col justify-start items-start gap-4 inline-flex">
                        {/* Header with Image and Info */}
                        <div className="justify-start items-end gap-3 inline-flex">
                          {/* Actor Portrait */}
                          <div className="w-14 h-14 rounded">
                            {draft.theme === 'people' ? (
                              <DraftActorPortrait 
                                actorName={getCleanActorName(draft.option)}
                                size="lg"
                                className="w-14 h-14 rounded object-cover"
                              />
                            ) : (
                              <div className="w-14 h-14 bg-greyscale-blue-200 rounded flex items-center justify-center">
                                {draft.theme === 'year' ? (
                                  <Calendar size={24} className="text-greyscale-blue-500" />
                                ) : (
                                  <User size={24} className="text-greyscale-blue-500" />
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Title and Status */}
                          <div className="flex-col justify-start items-start gap-2 inline-flex">
                            <div className="flex-col justify-start items-start flex">
                              <div className="justify-center flex flex-col text-[#2B2D2D] text-lg font-brockmann font-semibold leading-6">
                                {draft.theme === 'people' ? getCleanActorName(draft.option) : draft.option}
                              </div>
                            </div>
                            
                            {/* Status Chips */}
                            <div className="self-stretch h-6 justify-start items-start gap-2 inline-flex flex-wrap">
                              {/* Multiplayer/Local Badge */}
                              {draft.is_multiplayer ? (
                                <div className="px-3 py-1 bg-[#EBFFFA] rounded-full justify-start items-center flex" style={{boxShadow: 'inset 0 0 0 0.5px #015E45'}}>
                                  <span className="text-[#015E45] text-xs font-brockmann font-semibold leading-4">Multiplayer</span>
                                </div>
                              ) : (
                                <div className="px-3 py-1 bg-[#EDEBFF] rounded-full justify-start items-center flex" style={{boxShadow: 'inset 0 0 0 0.5px #3B0394'}}>
                                  <span className="text-[#3B0394] text-xs font-brockmann font-semibold leading-4">Local</span>
                                </div>
                              )}
                              
                              {/* Complete Badge */}
                              {draft.is_complete && (
                                <div className="px-3 py-1 bg-[#06C995] rounded-full justify-start items-center flex">
                                  <span className="text-white text-xs font-brockmann font-semibold leading-4">Complete</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Details */}
                        <div className="self-stretch justify-start items-center gap-2 inline-flex flex-wrap">
                          {/* Date */}
                          <div className="justify-start items-center gap-1 flex">
                            <div className="w-4 h-4 p-0.5 flex-col justify-center items-center gap-2.5 inline-flex">
                              <Calendar size={12} className="text-[#828786]" />
                            </div>
                            <span className="text-[#828786] text-sm font-brockmann font-medium leading-5">
                              {new Date(draft.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          
                          {/* Players */}
                          <div className="justify-start items-center gap-1 flex">
                            <div className="w-4 h-4 p-0.5 flex-col justify-center items-center gap-2.5 inline-flex">
                              <Users size={12} className="text-[#828786]" />
                            </div>
                            <span className="text-[#828786] text-sm font-brockmann font-medium leading-5">
                              {draft.participants.length} players
                            </span>
                          </div>
                          
                          {/* Categories */}
                          <div className="justify-start items-center gap-1 flex">
                            <div className="w-4 h-4 p-0.5 flex-col justify-center items-center gap-2.5 inline-flex">
                              <Trophy size={12} className="text-[#828786]" />
                            </div>
                            <span className="text-[#828786] text-sm font-brockmann font-medium leading-5">
                              {draft.categories.length} categories
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Right Container - Action Buttons */}
                      <div className="flex-1 max-w-[360px] min-w-[240px] flex-col justify-start items-end gap-4 inline-flex">
                        {/* Continue/View Draft Button */}
                        <button 
                          onClick={() => handleViewDraft(draft)}
                          className="self-stretch px-4 py-2 bg-[#680AFF] rounded-sm justify-center items-center inline-flex hover:bg-[#5A08E6] transition-colors"
                        >
                          <span className="text-center text-white text-sm font-brockmann font-medium leading-5">
                            {draft.is_complete ? 'View Draft' : 'Continue Draft'}
                          </span>
                        </button>
                        
                        {/* Delete Button */}
                        <button 
                          onClick={() => handleDeleteDraft(draft.id)}
                          className="px-3 py-2 rounded-sm justify-center items-center gap-2 inline-flex hover:bg-gray-100 transition-colors"
                        >
                          <div className="w-4 h-4 p-0.5 flex-col justify-center items-center gap-2.5 inline-flex">
                            <Trash2 size={12} className="text-[#646968]" />
                          </div>
                          <span className="text-center text-[#646968] text-sm font-brockmann font-medium leading-5">Delete</span>
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
