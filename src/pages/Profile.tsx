
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { syncMarketingAudience } from '@/lib/marketingAudienceSync';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Calendar, Users, Trophy, Trash2, User, Edit3, Save, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useDrafts } from '@/hooks/useDrafts';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { Settings } from 'lucide-react';
import BannerAd from '@/components/ads/BannerAd';
import InlineAd from '@/components/ads/InlineAd';
import { DraftActorPortrait } from '@/components/DraftActorPortrait';
import { getCleanActorName } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Profile = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { drafts, loading: draftsLoading, error: draftsError, refetch, deleteDraft } = useDrafts();
  const { toast } = useToast();
  const { isAdmin } = useAdminAccess();
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
  const [specDraftData, setSpecDraftData] = useState<Map<string, { name: string; photo_url: string | null }>>(new Map());
  const [marketingPrefUpdating, setMarketingPrefUpdating] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      setProfileError(null);
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        
        if (error) {
          throw error;
        }
        
        if (data) {
          setProfile(data);
          setNewName(data.name || '');
        } else {
          // Profile doesn't exist yet, which is fine
          setProfile(null);
          setNewName('');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load profile';
        setProfileError(errorMessage);
        toast({
          title: "Error loading profile",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [user, toast]);

  // Fetch spec draft data for spec-draft themes
  useEffect(() => {
    const fetchSpecDraftData = async () => {
      if (!drafts || drafts.length === 0) return;

      const specDraftIds = drafts
        .filter(draft => draft.theme === 'spec-draft' && draft.option)
        .map(draft => draft.option as string);

      if (specDraftIds.length === 0) return;

      try {
        const { data, error } = await (supabase as any)
          .from('spec_drafts')
          .select('id, name, photo_url')
          .in('id', specDraftIds);

        if (error) {
          console.error('Error fetching spec draft data:', error);
          return;
        }

        if (data) {
          const specDraftMap = new Map<string, { name: string; photo_url: string | null }>();
          data.forEach((specDraft: any) => {
            specDraftMap.set(specDraft.id, {
              name: specDraft.name,
              photo_url: specDraft.photo_url
            });
          });
          setSpecDraftData(specDraftMap);
        }
      } catch (err) {
        console.error('Error in fetchSpecDraftData:', err);
      }
    };

    fetchSpecDraftData();
  }, [drafts]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleViewDraft = useCallback(async (draft: any) => {
    // Validate that participants and categories are arrays
    const participants = Array.isArray(draft.participants) ? draft.participants : [];
    const categories = Array.isArray(draft.categories) ? draft.categories : [];
    
    navigate('/draft', {
      state: {
        theme: draft.theme,
        option: draft.option,
        participants,
        categories,
        existingDraftId: draft.id,
        isMultiplayer: draft.is_multiplayer
      }
    });
  }, [navigate]);

  const handleDeleteDraft = async () => {
    if (!draftToDelete) return;

    try {
      // First, delete all related draft picks
      const { error: picksError } = await supabase
        .from('draft_picks')
        .delete()
        .eq('draft_id', draftToDelete);

      if (picksError) {
        console.error('Error deleting draft picks:', picksError);
        // Continue with deletion even if picks deletion fails
      }

      // Then, delete all related draft participants
      const { error: participantsError } = await supabase
        .from('draft_participants')
        .delete()
        .eq('draft_id', draftToDelete);

      if (participantsError) {
        console.error('Error deleting draft participants:', participantsError);
        // Continue with deletion even if participants deletion fails
      }

      // Finally, delete the draft itself
      const { error: draftError } = await supabase
        .from('drafts')
        .delete()
        .eq('id', draftToDelete);

      if (draftError) {
        throw new Error(`Failed to delete draft: ${draftError.message}`);
      }

      toast({
        title: "Draft deleted",
        description: "Your draft has been successfully deleted.",
      });

      deleteDraft(draftToDelete);
      setShowDeleteDialog(false);
      setDraftToDelete(null);
    } catch (error: any) {
      console.error('Delete draft error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete draft. Please try again.",
        variant: "destructive",
      });
      setShowDeleteDialog(false);
      setDraftToDelete(null);
    }
  };

  const openDeleteDialog = useCallback((draftId: string) => {
    setDraftToDelete(draftId);
    setShowDeleteDialog(true);
  }, []);

  const handleSaveName = async () => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: newName.trim() })
        .eq('id', user.id);

      if (error) throw error;

      setProfile((prev: any) => prev ? { ...prev, name: newName.trim() } : { name: newName.trim() });
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

  const handleMarketingPrefChange = async (checked: boolean) => {
    if (!user?.id) return;
    setMarketingPrefUpdating(true);
    try {
      const updates: {
        marketing_emails_opt_in: boolean;
        marketing_emails_opt_in_at: string | null;
        marketing_emails_opt_out_at: string | null;
      } = checked
        ? {
            marketing_emails_opt_in: true,
            marketing_emails_opt_in_at: new Date().toISOString(),
            marketing_emails_opt_out_at: null,
          }
        : {
            marketing_emails_opt_in: false,
            marketing_emails_opt_in_at: null,
            marketing_emails_opt_out_at: new Date().toISOString(),
          };

      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);

      if (error) throw error;

      setProfile((prev: any) => (prev ? { ...prev, ...updates } : { ...updates }));

      const { error: syncError } = await syncMarketingAudience();
      if (syncError) {
        toast({
          title: 'Preference saved',
          description: `Saved in your account, but we could not sync to our email provider: ${syncError}. You can try again later.`,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Email preferences updated',
        description: checked
          ? 'You may receive product updates and occasional news from Movie Drafter.'
          : 'You will not receive marketing emails. You may still get transactional emails (e.g. password reset).',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update email preferences.',
        variant: 'destructive',
      });
    } finally {
      setMarketingPrefUpdating(false);
    }
  };

  // Memoize draft list to prevent unnecessary re-renders (must be before any early returns to satisfy Rules of Hooks)
  const draftList = useMemo(() => {
    return drafts.map((draft, index) => (
      <div key={draft.id} className="w-full">
        {/* New Draft Card Design */}
        <div className="w-full p-6 bg-greyscale-purp-850 rounded-[8px] flex justify-between items-center flex-wrap gap-4" style={{boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)', outline: '1px solid #49474B', outlineOffset: '-1px'}}>
          {/* Left Container */}
          <div className="flex-1 min-w-[240px] flex-col justify-start items-start gap-4 inline-flex">
            {/* Header with Image and Info */}
            <div className="justify-start items-start gap-3 inline-flex">
              {/* Actor Portrait / Spec Draft Image */}
              <div className="w-14 h-14 rounded-[4px] overflow-hidden">
                {draft.theme === 'spec-draft' ? (
                  (() => {
                    const specData = specDraftData.get(draft.option);
                    return specData?.photo_url ? (
                      <img 
                        src={specData.photo_url} 
                        alt={specData.name || 'Spec Draft'}
                        className="w-14 h-14 rounded-[4px] object-cover"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-greyscale-purp-800 rounded-[4px] flex items-center justify-center">
                        <User size={24} className="text-greyscale-blue-300" />
                      </div>
                    );
                  })()
                ) : draft.theme === 'people' ? (
                  <DraftActorPortrait 
                    actorName={getCleanActorName(draft.option)}
                    size="lg"
                    className="w-14 h-14 rounded-[4px] object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 bg-greyscale-purp-800 rounded-[4px] flex items-center justify-center">
                    {draft.theme === 'year' ? (
                      <Calendar size={24} className="text-greyscale-blue-300" />
                    ) : (
                      <User size={24} className="text-greyscale-blue-300" />
                    )}
                  </div>
                )}
              </div>
              
              {/* Title and Status */}
              <div className="flex-col justify-start items-start gap-2 inline-flex">
                <div className="flex-col justify-start items-start flex">
                  <div className="justify-center flex flex-col text-greyscale-blue-100 text-lg font-brockmann font-semibold leading-6">
                    {draft.theme === 'spec-draft' 
                      ? (specDraftData.get(draft.option)?.name || draft.option)
                      : draft.theme === 'people' 
                        ? getCleanActorName(draft.option) 
                        : draft.option}
                  </div>
                </div>
                
                {/* Status Chips */}
                <div className="self-stretch h-6 justify-start items-start gap-1.5 inline-flex flex-wrap">
                  {/* Multiplayer/Local Badge */}
                  {draft.is_multiplayer ? (
                    <div className="px-3 py-1 bg-teal-900 rounded-full justify-start items-center flex" style={{outline: '0.50px solid #B2FFEA', outlineOffset: '-0.50px'}}>
                      <span className="text-teal-200 text-xs font-brockmann font-semibold leading-4">Multiplayer</span>
                    </div>
                  ) : (
                    <div className="px-3 py-1 bg-purple-800 rounded-full justify-start items-center flex" style={{outline: '0.50px solid #EDEBFF', outlineOffset: '-0.50px'}}>
                      <span className="text-purple-100 text-xs font-brockmann font-semibold leading-4">Local</span>
                    </div>
                  )}
                  
                  {/* Complete Badge */}
                  {draft.is_complete && (
                    <div className="px-3 py-1 bg-teal-500 rounded-full justify-start items-center flex">
                      <span className="text-greyscale-purp-850 text-xs font-brockmann font-semibold leading-4">Complete</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Details */}
            <div className="self-stretch justify-start items-center gap-4 inline-flex flex-wrap">
              {/* Role badge: Host or Player */}
              <div className="justify-start items-center gap-1 flex">
                {draft.role === 'guest' ? (
                  <div
                    style={{
                      paddingLeft: 10,
                      paddingRight: 10,
                      paddingTop: 2,
                      paddingBottom: 2,
                      background: 'hsl(var(--greyscale-blue-800))',
                      borderRadius: 9999,
                      outline: '0.50px var(--Text-Light-grey, #BDC3C2) solid',
                      outlineOffset: '-0.50px',
                      justifyContent: 'flex-start',
                      alignItems: 'center',
                      display: 'inline-flex',
                    }}
                  >
                    <div
                      style={{
                        justifyContent: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        color: 'var(--Text-Light-grey, #BDC3C2)',
                        fontSize: 12,
                        fontFamily: 'Brockmann',
                        fontWeight: 600,
                        lineHeight: '16px',
                        wordWrap: 'break-word',
                      }}
                    >
                      Player
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      paddingLeft: 10,
                      paddingRight: 10,
                      paddingTop: 2,
                      paddingBottom: 2,
                      background: 'var(--Text-Light-grey, #BDC3C2)',
                      borderRadius: 9999,
                      justifyContent: 'flex-start',
                      alignItems: 'center',
                      display: 'inline-flex',
                    }}
                  >
                    <div
                      style={{
                        justifyContent: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        color: 'var(--UI-Primary, #1D1D1F)',
                        fontSize: 12,
                        fontFamily: 'Brockmann',
                        fontWeight: 600,
                        lineHeight: '16px',
                        wordWrap: 'break-word',
                      }}
                    >
                      Host
                    </div>
                  </div>
                )}
              </div>
              {/* Date */}
              <div className="justify-start items-center gap-1 flex">
                <div className="w-4 h-4 p-0.5 flex-col justify-center items-center gap-2.5 inline-flex">
                  <Calendar size={16} className="text-greyscale-blue-300" />
                </div>
                <span className="text-greyscale-blue-300 text-sm font-brockmann font-medium leading-5">
                  {new Date(draft.created_at).toLocaleDateString()}
                </span>
              </div>
              
              {/* Players */}
              <div className="justify-start items-center gap-1 flex">
                <div className="w-4 h-4 p-0.5 flex-col justify-center items-center gap-2.5 inline-flex">
                  <Users size={16} className="text-greyscale-blue-300" />
                </div>
                <span className="text-greyscale-blue-300 text-sm font-brockmann font-medium leading-5">
                  {draft.participant_count ?? draft.participants?.length ?? 0} players
                </span>
              </div>
              
              {/* Categories */}
              <div className="justify-start items-center gap-1 flex">
                <div className="w-4 h-4 p-0.5 flex-col justify-center items-center gap-2.5 inline-flex">
                  <Trophy size={16} className="text-greyscale-blue-300" />
                </div>
                <span className="text-greyscale-blue-300 text-sm font-brockmann font-medium leading-5">
                  {draft.categories?.length ?? 0} categories
                </span>
              </div>
            </div>
          </div>
          
          {/* Right Container - Action Buttons */}
          <div className="flex-1 max-w-[360px] min-w-[240px] h-[90px] flex-col justify-between items-end inline-flex">
            {/* Continue/View Draft Button */}
            <Button 
              onClick={() => handleViewDraft(draft)}
              variant="default"
              size="default"
              className="self-stretch bg-brand-primary hover:bg-purple-300 text-greyscale-blue-100 rounded-[2px] px-4 py-2"
            >
              {draft.is_complete ? 'View Draft' : 'Continue Draft'}
            </Button>
            
            {/* Delete Button */}
            {draft.role !== 'guest' && (
              <button 
                onClick={() => openDeleteDialog(draft.id)}
                className="px-3 py-2 rounded-[2px] justify-center items-center gap-2 inline-flex transition-colors"
              >
                <div className="w-4 h-4 p-0.5 flex-col justify-center items-center gap-2.5 inline-flex">
                  <Trash2 size={16} className="text-greyscale-blue-300" />
                </div>
                <span className="text-center text-greyscale-blue-300 text-sm font-brockmann font-medium leading-5">Delete</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Inline Ad after every 3 drafts - Hidden for now */}
        {/* {index > 0 && (index + 1) % 3 === 0 && <InlineAd />} */}
      </div>
    ));
  }, [drafts, handleViewDraft, openDeleteDialog, specDraftData]);

  // Show loading only for auth, allow profile and drafts to load independently
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
        <div style={{color: 'var(--Text-Primary, #FCFFFF)', fontSize: '20px'}}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
        <title>Movie Drafter - Your Profile</title>
        <meta name="description" content="View and manage your Movie Drafter profile. See all your drafts, track your progress, and manage your account settings." />
        <meta property="og:title" content="Movie Drafter - Your Profile" />
        <meta property="og:description" content="View and manage your Movie Drafter profile. See all your drafts, track your progress, and manage your account settings." />
        <meta property="og:url" content="https://moviedrafter.com/profile" />
        {socialShareImageMetaNodes()}
        <meta name="twitter:title" content="Movie Drafter - Your Profile" />
        <meta name="twitter:description" content="View and manage your Movie Drafter profile. See all your drafts, track your progress, and manage your account settings." />
      </Helmet>
      <div className="min-h-screen" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
        <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="w-full h-full justify-between items-center inline-flex mb-8">
          <div className="justify-start items-center gap-4 flex">
            <div className="flex-col justify-start items-start inline-flex">
              <h1 className="justify-center flex flex-col text-greyscale-blue-100 text-5xl font-chaney font-normal leading-[52px] tracking-[1.92px] m-0">
                Profile
              </h1>
            </div>
          </div>
          <div 
            onClick={handleSignOut}
            className="px-4 py-2 bg-brand-primary hover:bg-purple-300 rounded-[2px] justify-center items-center flex cursor-pointer transition-colors"
          >
            <div className="text-center justify-center flex flex-col text-greyscale-blue-100 text-sm font-brockmann font-medium leading-5">
              Sign Out
            </div>
          </div>
        </div>

        {/* Banner Ad - Hidden for now */}
        {/* <BannerAd className="mb-8" /> */}

        <div className="w-full h-full p-6 bg-greyscale-purp-900 rounded-[8px] flex-col justify-start items-start gap-3 inline-flex mb-8" style={{boxShadow: '0px 0px 6px #3B0394'}}>
          <div className="w-full flex justify-between items-center">
            <div className="flex-col justify-start items-start flex">
              <h2 className="justify-center flex flex-col text-greyscale-blue-100 text-2xl font-brockmann font-bold leading-8 tracking-[0.96px] m-0">
                Account Information
              </h2>
            </div>
            {isAdmin && (
              <Button
                onClick={() => navigate('/admin')}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Admin Panel
              </Button>
            )}
          </div>
          <div className="self-stretch justify-start items-center gap-4 inline-flex flex-wrap content-center">
            <div className="flex-1 min-w-[300px] justify-start items-center gap-1.5 flex">
              <div className="justify-center flex flex-col text-greyscale-blue-300 text-base font-brockmann font-semibold leading-6 tracking-[0.32px]">
                Name:
              </div>
              <div className="flex-col justify-start items-start inline-flex">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="bg-greyscale-purp-850 border-greyscale-purp-600 text-greyscale-blue-100"
                      placeholder="Enter your name"
                    />
                    <Button
                      onClick={handleSaveName}
                      size="sm"
                      className="bg-positive-green-500 hover:bg-positive-green-600"
                    >
                      <Save size={16} />
                    </Button>
                    <Button
                      onClick={handleCancelEdit}
                      size="sm"
                      variant="outline"
                      className="border-greyscale-purp-600 text-greyscale-blue-300 hover:bg-greyscale-purp-800"
                    >
                      <X size={16} />
                    </Button>
                  </div>
                ) : (
                  <div className="justify-center flex flex-col text-greyscale-blue-300 text-base font-brockmann font-normal leading-6">
                    {profile?.name || 'No name set'}
                  </div>
                )}
              </div>
              {!isEditingName && (
                <div 
                  onClick={() => setIsEditingName(true)}
                  className="p-1 rounded-md justify-center items-center flex cursor-pointer hover:bg-greyscale-purp-800"
                >
                  <div className="w-4 h-4 relative">
                    <Edit3 size={16} className="text-greyscale-blue-300" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-[300px] justify-start items-center gap-1.5 flex">
              <div className="justify-center flex flex-col">
                <span className="text-greyscale-blue-300 text-base font-brockmann font-bold leading-6">Email:</span>
                <span className="text-greyscale-blue-300 text-base font-brockmann font-normal leading-6"> </span>
              </div>
              <div className="justify-center flex flex-col text-greyscale-blue-300 text-base font-brockmann font-normal leading-6">
                {user.email}
              </div>
            </div>
            <div className="flex-1 min-w-[300px] justify-start items-start gap-1.5 flex">
              <div className="justify-center flex flex-col">
                <span className="text-greyscale-blue-300 text-base font-brockmann font-bold leading-6">Total Drafts:</span>
                <span className="text-greyscale-blue-300 text-base font-brockmann font-normal leading-6"> </span>
              </div>
              <div className="justify-center flex flex-col text-greyscale-blue-300 text-base font-brockmann font-normal leading-6">
                {drafts.length}
              </div>
            </div>
          </div>

          {!profileLoading && profile && (
            <div
              className="self-stretch mt-4 pt-4 flex flex-col gap-3"
              style={{ borderTop: '1px solid #49474B' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-col gap-1 max-w-xl">
                  <span className="text-greyscale-blue-100 text-base font-brockmann font-semibold leading-6">
                    Product updates by email
                  </span>
                  <span className="text-greyscale-blue-300 text-sm font-brockmann font-normal leading-5">
                    Optional. Get product news and occasional tips from Movie Drafter. You can change this anytime.
                    Marketing emails include an unsubscribe link. See our{' '}
                    <Link to="/privacy-policy" className="text-brand-primary hover:underline">
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </div>
                <Switch
                  checked={!!profile.marketing_emails_opt_in}
                  onCheckedChange={handleMarketingPrefChange}
                  disabled={marketingPrefUpdating}
                  className="shrink-0 data-[state=checked]:bg-brand-primary"
                  aria-label="Receive product updates by email"
                />
              </div>
            </div>
          )}
        </div>

        {/* Saved Drafts */}
        <div className="w-full h-full p-6 bg-greyscale-purp-900 rounded-[8px] flex-col justify-start items-start gap-6 inline-flex" style={{boxShadow: '0px 0px 6px #3B0394'}}>
          <div className="flex-col justify-start items-start flex">
            <h2 className="justify-center flex flex-col text-greyscale-blue-100 text-2xl font-brockmann font-bold leading-8 tracking-[0.96px] m-0">
              Saved Drafts
            </h2>
          </div>
          <div className="w-full">
            {draftsLoading ? (
              <p className="text-greyscale-blue-300 text-center py-8 font-brockmann">
                Loading drafts...
              </p>
            ) : draftsError ? (
              <div className="text-center py-8">
                <p className="text-error-red-400 font-brockmann mb-4">
                  {draftsError}
                </p>
                <Button onClick={() => refetch()} variant="outline">
                  Retry
                </Button>
              </div>
            ) : drafts.length === 0 ? (
              <p className="text-greyscale-blue-300 text-center py-8 font-brockmann">
                No saved drafts yet. Start a new draft to see it here!
              </p>
            ) : (
              <div className="flex flex-col gap-4 w-full">
                {draftList}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Draft</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this draft? This action cannot be undone and will permanently remove all draft data including picks and participants.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDraft}
              className="bg-destructive text-destructive-foreground hover:bg-[#CE0606]"
              style={{
                backgroundClip: 'unset',
                WebkitBackgroundClip: 'unset',
                backgroundColor: 'rgba(158, 3, 3, 1)',
                color: 'rgba(248, 250, 252, 1)'
              }}
            >
              Delete Draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </>
  );
};

export default Profile;
