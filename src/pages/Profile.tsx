
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { syncMarketingAudience } from '@/lib/marketingAudienceSync';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Calendar, Users, Trophy, Trash2, User, Edit3, Save, X, Camera, Plus, ChevronRight } from 'lucide-react';
import { uploadAvatarAndUpdateProfile, validateAvatarFile, getInitials } from '@/utils/avatarUpload';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useDrafts } from '@/hooks/useDrafts';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { useUserLeagues, usePendingLeagueInvites, useLeagueActions } from '@/hooks/useLeagues';
import { Settings } from 'lucide-react';
import BannerAd from '@/components/ads/BannerAd';
import InlineAd from '@/components/ads/InlineAd';
import { DraftActorPortrait } from '@/components/DraftActorPortrait';
import { TrophyIcon } from '@/components/icons';
import { getCleanActorName, formatCategoryDisplayName } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  const { leagues, loading: leaguesLoading } = useUserLeagues();
  const { invites: pendingInvites, loading: invitesLoading, refetch: refetchInvites } = usePendingLeagueInvites();
  const { acceptInvite, declineInvite } = useLeagueActions();
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
  const [draftLeagueFilter, setDraftLeagueFilter] = useState<string>('all');
  const [specDraftData, setSpecDraftData] = useState<Map<string, { name: string; photo_url: string | null }>>(new Map());
  const [marketingPrefUpdating, setMarketingPrefUpdating] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

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

  const draftFilterOptions = useMemo(() => {
    if (!drafts.length) return [] as { value: string; label: string; count: number }[];

    const options: { value: string; label: string; count: number }[] = [
      { value: 'all', label: 'All drafts', count: drafts.length },
    ];

    const personalCount = drafts.filter(d => !d.league_id).length;
    if (personalCount > 0) {
      options.push({ value: 'personal', label: 'Personal', count: personalCount });
    }

    const leagueMap = new Map<string, { name: string; count: number }>();
    for (const d of drafts) {
      if (!d.league_id) continue;
      const existing = leagueMap.get(d.league_id);
      if (existing) existing.count += 1;
      else leagueMap.set(d.league_id, { name: d.league_name ?? 'League', count: 1 });
    }
    for (const [id, { name, count }] of leagueMap) {
      options.push({ value: id, label: name, count });
    }

    return options;
  }, [drafts]);

  const showDraftLeagueFilter = draftFilterOptions.length > 1;

  const filteredDrafts = useMemo(() => {
    if (draftLeagueFilter === 'all') return drafts;
    if (draftLeagueFilter === 'personal') return drafts.filter(d => !d.league_id);
    return drafts.filter(d => d.league_id === draftLeagueFilter);
  }, [drafts, draftLeagueFilter]);

  useEffect(() => {
    if (draftLeagueFilter === 'all' || draftLeagueFilter === 'personal') return;
    if (!drafts.some(d => d.league_id === draftLeagueFilter)) {
      setDraftLeagueFilter('all');
    }
  }, [drafts, draftLeagueFilter]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleViewDraft = useCallback(async (draft: any) => {
    if (draft.is_complete) {
      navigate(`/final-scores/${draft.id}`);
    } else {
      navigate(`/draft/${draft.id}`);
    }
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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const err = validateAvatarFile(file);
    if (err) {
      toast({ title: 'Invalid file', description: err, variant: 'destructive' });
      return;
    }
    setIsUploadingAvatar(true);
    try {
      const avatarUrl = await uploadAvatarAndUpdateProfile(user.id, file);
      setProfile((prev: any) => prev ? { ...prev, avatar_url: avatarUrl } : prev);
      toast({ title: 'Photo updated', description: 'Your profile photo has been saved.' });
    } catch {
      toast({ title: 'Upload failed', description: 'Could not save your photo. Please try again.', variant: 'destructive' });
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
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

      const { error: syncError } = await syncMarketingAudience({ force: true });
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
    return filteredDrafts.map((draft, index) => (
      <div key={draft.id} className="w-full">
        {/* New Draft Card Design */}
        <div className="w-full p-6 bg-greyscale-purp-850 rounded-[8px] flex flex-wrap justify-between items-start gap-4" style={{boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)', outline: '1px solid #49474B', outlineOffset: '-1px'}}>
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
              {(draft.categories?.length ?? 0) > 0 ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex cursor-default items-center gap-1">
                      <div className="inline-flex h-4 w-4 flex-col items-center justify-center gap-2.5 p-0.5">
                        <Trophy size={16} className="text-greyscale-blue-300" />
                      </div>
                      <span className="text-greyscale-blue-300 text-sm font-brockmann font-medium leading-5">
                        {draft.categories.length} categories
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="max-w-xs border-[#49474B] bg-[#1D1D1F] text-greyscale-blue-100"
                  >
                    {draft.categories.map(formatCategoryDisplayName).join(', ')}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div className="flex items-center gap-1">
                  <div className="inline-flex h-4 w-4 flex-col items-center justify-center gap-2.5 p-0.5">
                    <Trophy size={16} className="text-greyscale-blue-300" />
                  </div>
                  <span className="text-greyscale-blue-300 text-sm font-brockmann font-medium leading-5">
                    0 categories
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* Right Container - Action Buttons */}
          <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:ml-auto sm:w-auto sm:min-w-[240px] sm:max-w-[360px] sm:items-end">
            {/* Continue/View Draft Button */}
            <Button 
              onClick={() => handleViewDraft(draft)}
              variant="default"
              size="default"
              className="self-stretch bg-brand-primary hover:bg-purple-300 text-greyscale-blue-100 rounded-[2px] px-4 py-2"
            >
              {draft.is_complete ? 'View Draft' : 'Continue Draft'}
            </Button>

            {draft.league_id && draft.league_name && (
              <button
                type="button"
                onClick={() => navigate(`/league/${draft.league_id}`)}
                className="inline-flex w-fit max-w-full items-center gap-2 self-end rounded-[2px] px-3 py-2 text-sm font-medium leading-5 text-[#907AFF] transition-colors hover:text-purple-200 font-brockmann"
              >
                <TrophyIcon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{draft.league_name}</span>
                <ChevronRight className="size-4 shrink-0" aria-hidden />
              </button>
            )}
            
            {/* Delete Button — league drafts are removed from the league dashboard only */}
            {draft.role !== 'guest' && !draft.league_id && (
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
  }, [filteredDrafts, handleViewDraft, openDeleteDialog, specDraftData, navigate]);

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
          {/* Avatar */}
          <div className="flex items-center gap-4 pb-2">
            <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                overflow: 'hidden',
                background: profile?.avatar_url ? 'transparent' : '#3B0394',
                border: '2px solid var(--Brand-Primary, #7142FF)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Profile"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{
                    color: '#FCFFFF',
                    fontSize: 30,
                    fontFamily: 'Brockmann',
                    fontWeight: '600',
                    userSelect: 'none',
                  }}>
                    {getInitials(profile?.name, user?.email)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Button
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                variant="ghost"
                size="sm"
                className="group border border-greyscale-purp-600 bg-greyscale-purp-850 text-greyscale-blue-300 shadow-none transition-colors hover:border-greyscale-purp-500 hover:bg-greyscale-purp-800 hover:text-greyscale-blue-100 focus-visible:text-greyscale-blue-100 flex items-center gap-2"
              >
                <Camera size={14} className="shrink-0 text-greyscale-blue-300 transition-colors group-hover:text-greyscale-blue-100" />
                {isUploadingAvatar ? 'Uploading...' : 'Edit photo'}
              </Button>
              <p className="text-greyscale-blue-500 text-xs font-brockmann">
                PNG, JPEG or WebP · Max 5MB
              </p>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
            />
          </div>

          <div className="self-stretch flex flex-wrap items-stretch gap-4">
            <div className="flex min-h-12 flex-1 min-w-[300px] items-center gap-1.5">
              <div className="flex shrink-0 flex-col justify-center text-greyscale-blue-300 text-base font-brockmann font-semibold leading-6 tracking-[0.32px]">
                Name:
              </div>
              <div className="inline-flex min-h-12 min-w-0 flex-1 flex-col justify-center items-start">
                {isEditingName ? (
                  <div className="flex w-full min-w-0 items-center gap-2">
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="min-h-12 flex-1 bg-greyscale-purp-850 border-greyscale-purp-600 text-greyscale-blue-100"
                      placeholder="Enter your name"
                    />
                    <Button
                      onClick={handleSaveName}
                      size="sm"
                      className="size-12 shrink-0 bg-positive-green-500 hover:bg-positive-green-600 p-0"
                    >
                      <Save size={16} />
                    </Button>
                    <Button
                      onClick={handleCancelEdit}
                      size="sm"
                      variant="ghost"
                      className="group size-12 shrink-0 border border-greyscale-purp-600 bg-greyscale-purp-850 text-greyscale-blue-300 shadow-none transition-colors hover:border-greyscale-purp-500 hover:bg-greyscale-purp-800 hover:text-greyscale-blue-100 focus-visible:text-greyscale-blue-100 p-0"
                    >
                      <X size={16} className="text-greyscale-blue-300 transition-colors group-hover:text-greyscale-blue-100" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex min-h-12 flex-col justify-center text-greyscale-blue-300 text-base font-brockmann font-normal leading-6">
                    {profile?.name || 'No name set'}
                  </div>
                )}
              </div>
              {!isEditingName && (
                <div
                  onClick={() => setIsEditingName(true)}
                  className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-greyscale-purp-800"
                >
                  <Edit3 size={16} className="text-greyscale-blue-300" />
                </div>
              )}
            </div>
            <div className="flex min-h-12 flex-1 min-w-[300px] items-center gap-1.5">
              <div className="shrink-0 text-greyscale-blue-300 text-base font-brockmann font-semibold leading-6 tracking-[0.32px]">
                Email:
              </div>
              <div className="min-w-0 flex-1 truncate text-greyscale-blue-300 text-base font-brockmann font-normal leading-6">
                {user.email}
              </div>
            </div>
            <div className="flex min-h-12 flex-1 min-w-[300px] items-center gap-1.5">
              <div className="shrink-0 text-greyscale-blue-300 text-base font-brockmann font-semibold leading-6 tracking-[0.32px]">
                Total Drafts:
              </div>
              <div className="text-greyscale-blue-300 text-base font-brockmann font-normal leading-6 tabular-nums">
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

        {/* Pending league invites */}
        {!invitesLoading && pendingInvites.length > 0 && (
          <div
            className="mb-8 inline-flex w-full flex-col items-start justify-start gap-4 rounded-lg p-6"
            style={{
              boxShadow: '0px 0px 6px #3B0394',
              background: 'var(--Section-Container, #0E0E0F)',
            }}
          >
            <h2 className="m-0 text-xl font-medium leading-7 text-greyscale-blue-100 font-brockmann">
              League Invites
            </h2>
            <div className="flex w-full flex-col gap-3">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex w-full flex-wrap items-center justify-between gap-4 rounded-[6px] px-4 py-3 font-brockmann"
                  style={{ background: '#1D1D1F', outline: '1px solid #2E2C32', outlineOffset: '-1px' }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-sm font-normal leading-5 text-[#FCFFFF]">
                      {invite.league?.name ?? 'A league'}
                    </p>
                    <p className="m-0 mt-0.5 text-xs font-normal leading-4 tracking-[0.36px] text-[#BDC3C2]">
                      Invited by {invite.inviter?.name ?? 'someone'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-[2px] bg-[#7142FF] px-[18px] py-2 text-sm font-medium leading-5 text-[#FCFFFF] transition-colors hover:bg-[#6338e0]"
                      onClick={async () => {
                        const leagueId = await acceptInvite(invite.id);
                        if (leagueId) { refetchInvites(); navigate(`/league/${leagueId}`); }
                      }}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-[2px] bg-[#1D1D1F] px-[18px] py-2 text-sm font-medium leading-5 text-[#FCFFFF] outline outline-1 -outline-offset-1 outline-[#666469] transition-colors hover:bg-[#252528]"
                      onClick={async () => { await declineInvite(invite.id); refetchInvites(); }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Leagues */}
        <div
          className="w-full inline-flex flex-col items-start justify-start gap-6 p-6 rounded-lg mb-8"
          style={{
            boxShadow: '0px 0px 6px #3B0394',
            background: 'var(--Section-Container, #0E0E0F)',
          }}
        >
          <div className="self-stretch inline-flex justify-between items-center gap-4">
            <div className="flex flex-1 min-w-0 items-center gap-2">
              <h2 className="m-0 text-greyscale-blue-100 text-xl font-brockmann font-medium leading-7">
                My Leagues
              </h2>
            </div>
            <Button
              type="button"
              className="shrink-0 h-auto gap-2 rounded-[2px] px-3 py-2 bg-[#7142FF] text-greyscale-blue-100 text-sm font-brockmann font-medium leading-5 shadow-none hover:bg-[#6338e0]"
              onClick={() => navigate('/league/create')}
            >
              <Plus className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              Create League
            </Button>
          </div>

          {leaguesLoading ? (
            <p className="m-0 text-greyscale-blue-300 text-sm font-brockmann">Loading leagues…</p>
          ) : leagues.length === 0 ? (
            <p className="m-0 text-greyscale-blue-300 text-sm font-brockmann leading-5">
              No leagues yet. Create one to compete with friends across multiple drafts.
            </p>
          ) : (
            <div className="self-stretch flex flex-col gap-3">
              {leagues.map((league) => (
                <button
                  key={league.id}
                  type="button"
                  className="self-stretch inline-flex cursor-pointer items-center gap-4 rounded-lg py-4 pl-[18px] pr-[18px] text-left outline outline-1 outline-offset-[-1px] outline-[#49474B] transition-colors hover:outline-[#5c5a5e]"
                  style={{ background: 'var(--UI-Primary, #1D1D1F)' }}
                  onClick={() => navigate(`/league/${league.id}`)}
                >
                  <div className="inline-flex min-w-0 flex-1 flex-col items-start justify-start gap-0.5">
                    <div className="flex w-full flex-col items-start justify-start">
                      <span className="w-full text-greyscale-blue-100 font-brockmann text-lg font-medium leading-[26px]">
                        {league.name}
                      </span>
                    </div>
                    <div className="flex w-full flex-col items-start justify-start">
                      <p className="m-0 font-brockmann text-sm leading-5 text-[#BDC3C2]">
                        <span className="font-bold tabular-nums">{league.member_count ?? 0}</span>
                        <span className="font-normal"> members | </span>
                        <span className="font-bold tabular-nums">{league.draft_count ?? 0}</span>
                        <span className="font-normal"> drafts</span>
                      </p>
                    </div>
                  </div>
                  <div className="inline-flex shrink-0 items-start justify-start gap-2">
                    <span className="inline-flex items-center justify-center rounded-[2px] p-3 text-greyscale-blue-100">
                      <ChevronRight className="size-6 shrink-0" strokeWidth={2} aria-hidden />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Saved Drafts */}
        <div className="w-full h-full p-6 bg-greyscale-purp-900 rounded-[8px] flex-col justify-start items-start gap-6 inline-flex" style={{boxShadow: '0px 0px 6px #3B0394'}}>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="justify-center flex flex-col text-greyscale-blue-100 text-2xl font-brockmann font-bold leading-8 tracking-[0.96px] m-0">
              Saved Drafts
            </h2>

            {showDraftLeagueFilter && !draftsLoading && (
              <Select value={draftLeagueFilter} onValueChange={setDraftLeagueFilter}>
                <SelectTrigger className="h-auto w-full rounded-[2px] border-0 bg-[#1D1D1F] px-4 py-3 text-sm font-brockmann text-[#BDC3C2] outline outline-1 -outline-offset-1 outline-[#BDC3C2] focus:ring-0 focus:ring-offset-0 sm:w-[min(100%,280px)]">
                  <SelectValue placeholder="Filter by league" />
                </SelectTrigger>
                <SelectContent>
                  {draftFilterOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="font-brockmann">
                      {opt.label} ({opt.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
            ) : filteredDrafts.length === 0 ? (
              <p className="text-greyscale-blue-300 text-center py-8 font-brockmann">
                No drafts match this filter.
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
