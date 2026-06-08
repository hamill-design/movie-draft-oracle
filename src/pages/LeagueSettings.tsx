import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowLeft,
  Crown,
  Mail,
  Search,
  UserMinus,
  Send,
  X,
  Plus,
  CalendarDays,
  Clock,
  Pencil,
  Check,
  Trash2,
  Monitor,
  Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Form } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import EnhancedCategoriesForm from '@/components/EnhancedCategoriesForm';
import { type DraftSetupForm } from '@/hooks/useDraftForm';
import { useDraftCategories } from '@/hooks/useDraftCategories';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import {
  useLeague,
  useLeagueDrafts,
  useLeagueMembers,
  useLeagueSeasons,
  useLeagueActions,
  type LeagueSeason,
} from '@/hooks/useLeagues';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MOVIE_DRAFTER_PURPLE_SHELL } from '@/lib/pageGradients';
import { format, isAfter, isBefore } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePeopleSearch } from '@/hooks/usePeopleSearch';
import { ActorPortrait } from '@/components/ActorPortrait';
import { HeaderIcon3 } from '@/components/HeaderIcon3';
import { PersonIcon, CalendarIcon } from '@/components/icons';
import {
  fetchPublicSpecDraftSummaries,
  type PublicSpecDraftSummary,
} from '@/services/publicSpecDrafts';

// ─────────────────────────────────────────────────────────────────────────────

const TAB_IDS = ['general', 'seasons', 'schedule', 'invite'] as const;
type TabId = (typeof TAB_IDS)[number];

const NAV_ITEMS: { id: TabId; label: string }[] = [
  { id: 'general', label: 'General Information' },
  { id: 'seasons', label: 'Seasons' },
  { id: 'schedule', label: 'Schedule Draft' },
  { id: 'invite', label: 'Invite Members' },
];

type ScheduleSlice = 'filmography' | 'year' | 'alternate';

function sectionShellProps() {
  return {
    className: 'rounded-lg p-4 text-greyscale-blue-100 md:p-6',
    style: { background: '#0E0E0F', boxShadow: '0px 0px 6px #3B0394' } as React.CSSProperties,
  };
}

const inputDark =
  'bg-[#252528] border border-[#49474B] text-greyscale-blue-50 placeholder:text-greyscale-blue-400 focus-visible:ring-purple-400/40';

/** Dark field + light native date-picker control icon */
const inputDateDark = cn(inputDark, 'date-input-icon-light');

const draftFieldOutline = { outline: '1px solid #666469', outlineOffset: '-1px' } as const;

const draftInputClass =
  'rounded-[2px] bg-greyscale-purp-850 text-greyscale-blue-100 placeholder:text-greyscale-blue-500 border-0 focus:border-0 focus-visible:ring-0 font-brockmann font-medium text-sm leading-5';

const draftSelectTriggerClass = cn(
  draftInputClass,
  'h-auto px-4 py-3 focus:ring-0 focus:ring-offset-0 w-full',
);

const getInitials = (name: string | null | undefined) =>
  !name ? '?' : name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

const toLocalDateValue = (iso: string) => iso.slice(0, 10);

const seasonStatus = (s: LeagueSeason): 'active' | 'upcoming' | 'past' => {
  const now = new Date();
  if (isBefore(now, new Date(s.starts_at))) return 'upcoming';
  if (isAfter(now, new Date(s.ends_at))) return 'past';
  return 'active';
};

function personSubtitle(p: {
  known_for_department?: string | null;
  known_for?: { title?: string; name?: string }[];
}) {
  const dept = p.known_for_department ?? 'Film';
  const titles = (p.known_for ?? [])
    .slice(0, 3)
    .map((m) => m?.title ?? m?.name)
    .filter(Boolean)
    .join(', ');
  return titles ? `${dept} • Known for ${titles}` : dept;
}

function SectionDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full items-center justify-center gap-2">
      <div
        className="min-h-0 min-w-0 flex-1 border-t border-[#907AFF]"
        aria-hidden
      />
      <div className="flex shrink-0 flex-col justify-center text-center text-[#907AFF] font-brockmann text-[12px] font-normal leading-4 tracking-[0.72px]">
        {children}
      </div>
      <div
        className="min-h-0 min-w-0 flex-1 border-t border-[#907AFF]"
        aria-hidden
      />
    </div>
  );
}

function NavButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'self-stretch px-3 py-1.5 flex justify-start items-center border-l-2 text-left whitespace-nowrap',
        active ? 'border-purple-300' : 'border-transparent',
      )}
      style={{ fontFamily: 'Brockmann', fontWeight: 600 }}
    >
      <span
        className={cn(
          'text-base leading-6 tracking-[0.32px]',
          active ? 'text-purple-300' : 'text-greyscale-blue-100',
        )}
      >
        {label}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const LeagueSettings = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const rawTab = searchParams.get('tab') ?? 'general';
  const activeTab: TabId = TAB_IDS.includes(rawTab as TabId) ? (rawTab as TabId) : 'general';

  const setTab = useCallback(
    (id: TabId) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('tab', id);
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const { league, loading: leagueLoading, refetch: refetchLeague } = useLeague(leagueId);
  const { members, loading: membersLoading, refetch: refetchMembers } = useLeagueMembers(leagueId);
  const { seasons, loading: seasonsLoading, refetch: refetchSeasons } = useLeagueSeasons(leagueId);
  const { drafts, refetch: refetchDrafts } = useLeagueDrafts(leagueId);
  const {
    updateLeagueName,
    createSeason,
    updateSeason,
    deleteSeason,
    scheduleDraft,
    updateScheduledDraft,
    removeScheduledDraft,
    removeMember,
    inviteByUsername,
  } = useLeagueActions();

  const [adminProfile, setAdminProfile] = useState<{ name: string | null; email: string | null }>({
    name: null,
    email: null,
  });

  // ── General ──
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [editingLeagueName, setEditingLeagueName] = useState(false);

  // ── Seasons ──
  const [showSeasonForm, setShowSeasonForm] = useState(false);
  const [seasonName, setSeasonName] = useState('');
  const [seasonStart, setSeasonStart] = useState('');
  const [seasonEnd, setSeasonEnd] = useState('');
  const [creatingSeason, setCreatingSeason] = useState(false);
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null);
  const [editSeasonName, setEditSeasonName] = useState('');
  const [editSeasonStart, setEditSeasonStart] = useState('');
  const [editSeasonEnd, setEditSeasonEnd] = useState('');
  const [savingSeason, setSavingSeason] = useState(false);
  const [seasonToDelete, setSeasonToDelete] = useState<LeagueSeason | null>(null);

  // ── Schedule draft ──
  const [schedDatePart, setSchedDatePart] = useState('');
  const [schedTimePart, setSchedTimePart] = useState('');
  const [schedSeason, setSchedSeason] = useState('none');
  const [schedNotes, setSchedNotes] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [scheduleSlice, setScheduleSlice] = useState<ScheduleSlice>('filmography');
  const [schedIsMultiplayer, setSchedIsMultiplayer] = useState(false);
  const [altDraftType, setAltDraftType] = useState<'classic' | 'spec-draft'>('classic');
  const [yearThemeInput, setYearThemeInput] = useState('');
  const [personSearch, setPersonSearch] = useState('');
  const { people: personResults, loading: peopleSearching } = usePeopleSearch(personSearch);
  type PersonRow = NonNullable<(typeof personResults)[0]>;
  const [selectedPerson, setSelectedPerson] = useState<PersonRow | null>(null);
  const [specSummaries, setSpecSummaries] = useState<PublicSpecDraftSummary[]>([]);
  const scheduleCategoryForm = useForm<DraftSetupForm>({
    defaultValues: { participants: [], categories: [] },
  });
  const [specDraftId, setSpecDraftId] = useState('');
  // Player selection: UUIDs of members included in this draft (empty = all)
  const [schedPlayerIds, setSchedPlayerIds] = useState<string[]>([]);
  // Edit mode: non-null when editing an existing scheduled entry
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  // Entry pending deletion confirmation
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (scheduleSlice === 'alternate' && altDraftType === 'spec-draft' && specSummaries.length === 0) {
      fetchPublicSpecDraftSummaries().then(setSpecSummaries);
    }
  }, [scheduleSlice, altDraftType, specSummaries.length]);

  useEffect(() => {
    if (scheduleSlice === 'alternate') {
      scheduleCategoryForm.reset({ participants: [], categories: [] });
    }
  }, [scheduleSlice, scheduleCategoryForm]);

  useEffect(() => {
    setSelectedPerson(null);
    setPersonSearch('');
    scheduleCategoryForm.reset({ participants: [], categories: [] });
  }, [scheduleSlice, scheduleCategoryForm]);

  // ── Invite ──
  const [emailInput, setEmailInput] = useState('');
  const [emailList, setEmailList] = useState<string[]>([]);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; display_name: string | null; photo_url: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);

  useEffect(() => {
    if (league) setNewName(league.name);
  }, [league]);

  useEffect(() => {
    let cancelled = false;
    async function fetchAdmin() {
      if (!league?.admin_id) return;
      const { data } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', league.admin_id)
        .maybeSingle();
      if (!cancelled && data) {
        setAdminProfile({
          name: (data as { name: string | null }).name,
          email: (data as { email: string | null }).email,
        });
      }
    }
    fetchAdmin();
    return () => { cancelled = true; };
  }, [league?.admin_id]);

  useEffect(() => {
    if (!leagueLoading && league && league.admin_id !== user?.id) {
      navigate(`/league/${leagueId}`);
    }
  }, [league, leagueLoading, user, leagueId, navigate]);

  // When members load (and we're NOT already in edit mode), default all players selected
  useEffect(() => {
    if (!membersLoading && members.length > 0 && !editingEntryId) {
      setSchedPlayerIds(members.map((m) => m.user_id));
    }
  }, [membersLoading, members.length, editingEntryId]);

  // Detect ?edit=<entryId> in the URL and pre-populate the scheduling form
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId || drafts.length === 0 || membersLoading) return;
    const entry = drafts.find((d) => d.id === editId && !d.draft_id);
    if (!entry) return;

    setEditingEntryId(editId);
    setTab('schedule');

    // Date / time
    if (entry.scheduled_at) {
      const dt = new Date(entry.scheduled_at);
      setSchedDatePart(dt.toISOString().slice(0, 10));
      // format HH:mm in local time
      const hh = String(dt.getHours()).padStart(2, '0');
      const mm = String(dt.getMinutes()).padStart(2, '0');
      setSchedTimePart(`${hh}:${mm}`);
    }

    // Season
    setSchedSeason(entry.season_id ?? 'none');

    // Multiplayer
    setSchedIsMultiplayer(!!entry.is_multiplayer);

    // Notes
    setSchedNotes(entry.notes ?? '');

    // Draft type / theme
    const t = entry.draft_type;
    if (t === 'filmography' || t === 'people') {
      setScheduleSlice('filmography');
      // Reconstruct a minimal PersonRow so the UI shows the selection
      if (entry.theme) {
        setSelectedPerson({ id: -1, name: entry.theme, profile_path: null, known_for_department: null, known_for: [] } as any);
      }
    } else if (t === 'year') {
      setScheduleSlice('year');
      setYearThemeInput(entry.theme ?? '');
    } else if (t === 'spec-draft') {
      setScheduleSlice('alternate');
      setAltDraftType('spec-draft');
      setSpecDraftId(entry.theme ?? '');
    } else {
      setScheduleSlice('alternate');
      setAltDraftType('classic');
    }

    // Categories
    if (entry.categories?.length) {
      scheduleCategoryForm.reset({ participants: [], categories: entry.categories });
    }

    // Player selection: use saved player_ids or fall back to all members
    if (entry.player_ids?.length) {
      setSchedPlayerIds(entry.player_ids);
    } else {
      setSchedPlayerIds(members.map((m) => m.user_id));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('edit'), drafts.length, membersLoading]);

  const groupedSeasons = useMemo(() => {
    const currentLike = seasons.filter((s) => seasonStatus(s) !== 'past');
    const prev = seasons.filter((s) => seasonStatus(s) === 'past');
    const sortByStart = (a: LeagueSeason, b: LeagueSeason) =>
      new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
    currentLike.sort(sortByStart);
    prev.sort(sortByStart);
    return { currentLike, prev };
  }, [seasons]);

  const scheduleTheme =
    scheduleSlice === 'year' ? 'year' : scheduleSlice === 'filmography' ? 'people' : null;
  const scheduleCategories = useDraftCategories(scheduleTheme);
  const scheduleSelectedOption =
    scheduleSlice === 'filmography'
      ? selectedPerson?.name ?? ''
      : scheduleSlice === 'year'
        ? yearThemeInput.trim()
        : '';
  const selectedCategoriesList = scheduleCategoryForm.watch('categories') ?? [];
  const schedulePlayerCount = Math.max(schedPlayerIds.length || members.length, 2);
  const showScheduleCategories =
    scheduleSlice !== 'alternate'
    && scheduleCategories.length > 0
    && (scheduleSlice === 'year' || !!selectedPerson);

  const draftCountTotal = drafts.length;
  const scheduledEntries = useMemo(
    () => drafts.filter((d) => !d.draft_id && !!d.scheduled_at),
    [drafts],
  );

  // Must be defined before any early returns (Rules of Hooks)
  const resetScheduleForm = useCallback(() => {
    setSchedDatePart('');
    setSchedTimePart('');
    setSchedSeason('none');
    setSchedNotes('');
    setSchedIsMultiplayer(false);
    setScheduleSlice('filmography');
    setYearThemeInput('');
    setSelectedPerson(null);
    setSpecDraftId('');
    scheduleCategoryForm.reset({ participants: [], categories: [] });
    setSchedPlayerIds(members.map((m) => m.user_id));
    setEditingEntryId(null);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('edit');
      return p;
    }, { replace: true });
  }, [members, scheduleCategoryForm, setSearchParams]);

  if (leagueLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 font-brockmann text-greyscale-blue-100"
        style={{ background: MOVIE_DRAFTER_PURPLE_SHELL }}
      >
        <p className="text-sm text-greyscale-blue-200">Loading…</p>
      </div>
    );
  }

  if (!league) return null;

  // ── Handlers: General ─────────────────────────────────────────────────────

  const handleSaveName = async () => {
    if (!newName.trim() || newName.trim() === league.name) return;
    setSavingName(true);
    const ok = await updateLeagueName(leagueId!, newName.trim());
    setSavingName(false);
    if (ok) {
      toast({ title: 'League renamed.' });
      setEditingLeagueName(false);
      refetchLeague();
    } else toast({ title: 'Could not rename league.', variant: 'destructive' });
  };

  const handleCreateSeason = async () => {
    if (!seasonName.trim() || !seasonStart || !seasonEnd) return;
    if (seasonStart >= seasonEnd) {
      toast({ title: 'End date must be after start date.', variant: 'destructive' });
      return;
    }
    setCreatingSeason(true);
    const result = await createSeason(
      leagueId!,
      seasonName.trim(),
      new Date(seasonStart).toISOString(),
      new Date(seasonEnd).toISOString(),
    );
    setCreatingSeason(false);
    if (result) {
      toast({ title: 'Season created.' });
      setSeasonName('');
      setSeasonStart('');
      setSeasonEnd('');
      setShowSeasonForm(false);
      refetchSeasons();
    } else {
      toast({ title: 'Could not create season.', variant: 'destructive' });
    }
  };

  const startEditSeason = (s: LeagueSeason) => {
    setShowSeasonForm(false);
    setEditingSeasonId(s.id);
    setEditSeasonName(s.name);
    setEditSeasonStart(toLocalDateValue(s.starts_at));
    setEditSeasonEnd(toLocalDateValue(s.ends_at));
  };

  const handleSaveSeason = async () => {
    if (!editingSeasonId || !editSeasonName.trim() || !editSeasonStart || !editSeasonEnd) return;
    if (editSeasonStart >= editSeasonEnd) {
      toast({ title: 'End date must be after start date.', variant: 'destructive' });
      return;
    }
    setSavingSeason(true);
    const ok = await updateSeason(editingSeasonId, {
      name: editSeasonName.trim(),
      starts_at: new Date(editSeasonStart).toISOString(),
      ends_at: new Date(editSeasonEnd).toISOString(),
    });
    setSavingSeason(false);
    if (ok) {
      toast({ title: 'Season updated.' });
      setEditingSeasonId(null);
      refetchSeasons();
    } else {
      toast({ title: 'Could not update season.', variant: 'destructive' });
    }
  };

  const handleDeleteSeason = async () => {
    if (!seasonToDelete) return;
    const id = seasonToDelete.id;
    const wasEditing = editingSeasonId === id;
    const ok = await deleteSeason(id);
    setSeasonToDelete(null);
    if (ok) {
      refetchSeasons();
      toast({ title: 'Season deleted.' });
      if (wasEditing) setEditingSeasonId(null);
    } else toast({ title: 'Could not delete season.', variant: 'destructive' });
  };

  const handleScheduleDraft = async () => {
    if (!schedDatePart || !schedTimePart) {
      toast({ title: 'Pick a date and time.', variant: 'destructive' });
      return;
    }
    const scheduledAt = new Date(`${schedDatePart}T${schedTimePart}`);
    if (Number.isNaN(scheduledAt.getTime())) {
      toast({ title: 'Invalid date or time.', variant: 'destructive' });
      return;
    }

    let draftType: string = 'filmography';
    let themeValue: string | undefined;
    let categoriesOut: string[] | undefined;

    if (scheduleSlice === 'filmography') {
      if (!selectedPerson) {
        toast({ title: 'Select a filmmaker.', variant: 'destructive' });
        return;
      }
      draftType = 'filmography';
      themeValue = selectedPerson.name;
      categoriesOut = selectedCategoriesList.length ? selectedCategoriesList : undefined;
    } else if (scheduleSlice === 'year') {
      const y = yearThemeInput.trim();
      if (!y) {
        toast({ title: 'Enter a year or era for the draft.', variant: 'destructive' });
        return;
      }
      draftType = 'year';
      themeValue = y;
      categoriesOut = selectedCategoriesList.length ? selectedCategoriesList : undefined;
    } else {
      draftType = altDraftType;
      if (altDraftType === 'spec-draft') {
        if (!specDraftId) {
          toast({ title: 'Choose a special draft.', variant: 'destructive' });
          return;
        }
        themeValue = specDraftId;
      }
      categoriesOut = undefined;
    }

    // Determine player_ids: empty means "all members"
    const allSelected = schedPlayerIds.length === members.length;
    const playerIdsOut = allSelected ? [] : schedPlayerIds;

    setScheduling(true);

    let ok: boolean;
    if (editingEntryId) {
      ok = await updateScheduledDraft(editingEntryId, {
        scheduled_at: scheduledAt.toISOString(),
        draft_type: draftType,
        theme: themeValue ?? null,
        categories: categoriesOut ?? [],
        notes: schedNotes.trim() || null,
        is_multiplayer: schedIsMultiplayer,
        player_ids: playerIdsOut,
        season_id: schedSeason !== 'none' ? schedSeason : null,
      });
    } else {
      ok = await scheduleDraft(
        leagueId!,
        scheduledAt.toISOString(),
        draftType,
        schedSeason !== 'none' ? schedSeason : undefined,
        schedNotes.trim() || undefined,
        themeValue,
        categoriesOut,
        schedIsMultiplayer,
        playerIdsOut,
      );
    }

    setScheduling(false);
    if (ok) {
      toast({ title: editingEntryId ? 'Draft updated.' : 'Draft scheduled.' });
      resetScheduleForm();
      refetchDrafts();
    } else {
      toast({ title: editingEntryId ? 'Could not update draft.' : 'Could not schedule draft.', variant: 'destructive' });
    }
  };

  const handleDeleteScheduledEntry = async () => {
    if (!entryToDelete) return;
    const ok = await removeScheduledDraft(entryToDelete);
    setEntryToDelete(null);
    if (ok) {
      // If we were editing this entry, reset the form
      if (editingEntryId === entryToDelete) resetScheduleForm();
      refetchDrafts();
      toast({ title: 'Scheduled draft removed.' });
    } else {
      toast({ title: 'Could not remove scheduled draft.', variant: 'destructive' });
    }
  };

  const handleAddEmail = () => {
    const email = emailInput.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email) || emailList.includes(email)) return;
    setEmailList((prev) => [...prev, email]);
    setEmailInput('');
  };

  const handleSendEmailInvites = async () => {
    if (!emailList.length) return;
    setSendingEmails(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-league-invitations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            leagueId: leagueId!,
            leagueName: league.name,
            adminName: user?.user_metadata?.full_name ?? user?.email ?? 'Your friend',
            emails: emailList,
          }),
        },
      );
      const result = await res.json();
      if (result.success) {
        toast({ title: `${result.summary.sent} invite${result.summary.sent !== 1 ? 's' : ''} sent.` });
        setEmailList([]);
      } else throw new Error(result.error);
    } catch (err) {
      toast({ title: 'Failed to send invites.', description: String(err), variant: 'destructive' });
    }
    setSendingEmails(false);
  };

  const handleUserSearch = async (query: string) => {
    setUserSearch(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const memberIds = members.map((m) => m.user_id);
    const { data } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .ilike('name', `%${query.trim()}%`)
      .not('id', 'in', `(${[...memberIds, user!.id].join(',')})`)
      .limit(8);
    setSearchResults(
      (data ?? []).map((r: { id: string; name: string | null; avatar_url: string | null }) => ({
        id: r.id,
        display_name: r.name,
        photo_url: r.avatar_url,
      })),
    );
    setSearching(false);
  };

  const handleInviteUser = async (targetId: string) => {
    setSendingInvite(targetId);
    const ok = await inviteByUsername(leagueId!, targetId);
    setSendingInvite(null);
    if (ok) {
      toast({ title: 'Invite sent.' });
      setSearchResults((prev) => prev.filter((r) => r.id !== targetId));
    } else toast({ title: 'Could not send invite.', variant: 'destructive' });
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    const ok = await removeMember(leagueId!, memberToRemove);
    setMemberToRemove(null);
    if (ok) {
      refetchMembers();
      toast({ title: 'Member removed.' });
    } else toast({ title: 'Could not remove member.', variant: 'destructive' });
  };

  const shell = sectionShellProps();

  const seasonsPanelEditing = !!editingSeasonId || showSeasonForm;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Helmet>
        <title>{league.name} Settings — Movie Drafter</title>
      </Helmet>

      <div
        className="min-h-screen px-3 py-6 font-brockmann text-greyscale-blue-100 md:p-6"
        style={{
          background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)',
        }}
      >
        <div className="mx-auto w-full max-w-7xl">
          <Button
            variant="ghost"
            onClick={() => navigate(`/league/${leagueId}`)}
            className="-ml-1 mb-4 text-greyscale-blue-100 hover:bg-white/10 hover:text-white md:-ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2 shrink-0" />
            Back to League
          </Button>

          <h1 className="text-greyscale-blue-100 text-2xl font-brockmann font-bold leading-8 tracking-wide m-0 mb-6 md:mb-8">
            League Settings
          </h1>

          <div className="flex flex-col items-start gap-6 lg:flex-row lg:gap-8">
            <nav className="w-full lg:w-[206px] flex flex-col gap-4 shrink-0">
              <div className="flex flex-col gap-1">
                {NAV_ITEMS.map((item) => (
                  <NavButton
                    key={item.id}
                    label={item.label}
                    active={activeTab === item.id}
                    onClick={() => setTab(item.id)}
                  />
                ))}
              </div>
            </nav>

            <div className="min-w-0 flex-1 space-y-6 md:space-y-8">
              {activeTab === 'general' && (
                <section {...shell}>
                  <h2 className="text-xl font-bold text-greyscale-blue-50 font-brockmann tracking-tight m-0 mb-8">
                    General Information
                  </h2>

                  <div className="space-y-0 divide-y divide-white/10">
                    <div className="flex items-start justify-between gap-4 py-5 first:pt-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-purple-300 font-semibold uppercase tracking-wide m-0 mb-1">
                          Name
                        </p>
                        {editingLeagueName ? (
                          <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            maxLength={60}
                            className={cn('mt-1 max-w-md', inputDark)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                          />
                        ) : (
                          <p className="text-lg text-greyscale-blue-50 m-0 truncate">{league.name}</p>
                        )}
                      </div>
                      {editingLeagueName ? (
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-purple-200 hover:text-white"
                            onClick={() => {
                              setEditingLeagueName(false);
                              setNewName(league.name);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button size="sm" onClick={handleSaveName} disabled={savingName || !newName.trim()}>
                            {savingName ? 'Saving…' : (<><Check className="w-4 h-4 mr-1" /> Save</>)}
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          aria-label="Edit league name"
                          className="p-2 rounded text-greyscale-blue-400 hover:text-purple-300 hover:bg-white/10"
                          onClick={() => setEditingLeagueName(true)}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="py-5">
                      <p className="text-sm text-purple-300 font-semibold uppercase tracking-wide m-0 mb-1">
                        Admin
                      </p>
                      <p className="text-lg text-greyscale-blue-50 m-0 truncate">
                        {adminProfile.email ?? adminProfile.name ?? '—'}
                      </p>
                    </div>

                    <div className="py-5">
                      <p className="text-sm text-purple-300 font-semibold uppercase tracking-wide m-0 mb-1">
                        Total drafts
                      </p>
                      <p className="text-lg text-greyscale-blue-50 m-0">
                        {draftCountTotal}
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {activeTab === 'seasons' && (
                <section {...shell}>
                  {!seasonsPanelEditing && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                      <h2 className="text-xl font-bold text-greyscale-blue-50 font-brockmann tracking-tight m-0">
                        Your Seasons
                      </h2>
                      <button
                        type="button"
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[2px] bg-[#7142FF] px-3 py-2 text-sm font-medium leading-5 text-greyscale-blue-100 transition-colors hover:bg-[#6338e0] font-brockmann"
                        onClick={() => {
                          setEditingSeasonId(null);
                          setShowSeasonForm(true);
                          setSeasonName('');
                          setSeasonStart('');
                          setSeasonEnd('');
                        }}
                      >
                        <Plus className="size-4" aria-hidden />
                        New Season
                      </button>
                    </div>
                  )}

                  {showSeasonForm && (
                    <>
                      <div className="flex items-start justify-between gap-4 mb-6">
                        <h3 className="text-lg font-bold text-purple-300 font-brockmann uppercase tracking-wide m-0">
                          New Season
                        </h3>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-greyscale-blue-400"
                          onClick={() => setShowSeasonForm(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                      <div className="grid w-full min-w-0 gap-6">
                        <div className="space-y-2">
                          <Label className="text-greyscale-blue-200">Season name</Label>
                          <Input
                            placeholder="e.g. Summer 2026, 90s Icons"
                            value={seasonName}
                            onChange={(e) => setSeasonName(e.target.value)}
                            className={inputDark}
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-greyscale-blue-200">Start Date</Label>
                            <Input
                              type="date"
                              value={seasonStart}
                              onChange={(e) => setSeasonStart(e.target.value)}
                              className={inputDateDark}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-greyscale-blue-200">End Date</Label>
                            <Input
                              type="date"
                              value={seasonEnd}
                              onChange={(e) => setSeasonEnd(e.target.value)}
                              className={inputDateDark}
                            />
                          </div>
                        </div>
                        <div className="flex gap-4 pt-2">
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-purple-200 hover:text-white px-0"
                            onClick={() => setShowSeasonForm(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleCreateSeason}
                            disabled={
                              creatingSeason
                              || !seasonName.trim()
                              || !seasonStart
                              || !seasonEnd
                            }
                          >
                            {creatingSeason ? 'Saving…' : 'Save Season'}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}

                  {editingSeasonId && (
                    <>
                      <div className="flex items-start justify-between gap-4 mb-6">
                        <h3 className="text-lg font-bold text-purple-300 font-brockmann uppercase tracking-wide m-0">
                          Edit Season
                        </h3>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="p-2 rounded text-greyscale-blue-400 hover:text-error-red-400 hover:bg-white/10"
                            aria-label="Delete season"
                            onClick={() => {
                              const s = seasons.find((x) => x.id === editingSeasonId);
                              if (s) setSeasonToDelete(s);
                            }}
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-greyscale-blue-400"
                            onClick={() => setEditingSeasonId(null)}
                          >
                            Close
                          </Button>
                        </div>
                      </div>
                      <div className="grid w-full min-w-0 gap-6">
                        <div className="space-y-2">
                          <Label className="text-greyscale-blue-200">Season Name</Label>
                          <Input
                            value={editSeasonName}
                            onChange={(e) => setEditSeasonName(e.target.value)}
                            className={inputDark}
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-greyscale-blue-200">Start Date</Label>
                            <Input
                              type="date"
                              value={editSeasonStart}
                              onChange={(e) => setEditSeasonStart(e.target.value)}
                              className={inputDateDark}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-greyscale-blue-200">End Date</Label>
                            <Input
                              type="date"
                              value={editSeasonEnd}
                              onChange={(e) => setEditSeasonEnd(e.target.value)}
                              className={inputDateDark}
                            />
                          </div>
                        </div>
                        <div className="flex gap-4 pt-2">
                          <button
                            type="button"
                            className="text-sm font-semibold text-purple-200 hover:text-white underline-offset-4 hover:underline px-0"
                            onClick={() => setEditingSeasonId(null)}
                          >
                            Cancel
                          </button>
                          <Button onClick={handleSaveSeason} disabled={savingSeason}>
                            {savingSeason ? 'Saving…' : 'Save Season'}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}

                  {!seasonsPanelEditing && (
                    <>
                      {seasonsLoading ? (
                        <p className="text-sm text-greyscale-blue-300 py-10 text-center">Loading…</p>
                      ) : seasons.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-white/20 rounded-lg bg-black/20">
                          <CalendarDays className="w-8 h-8 text-purple-400/80 mx-auto mb-3" />
                          <p className="text-greyscale-blue-100 font-medium m-0">No seasons yet</p>
                          <p className="text-xs text-greyscale-blue-400 mt-2 m-0 max-w-xs mx-auto">
                            Create seasons to organise standings across time ranges.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {groupedSeasons.currentLike.length > 0 && (
                            <>
                              <SectionDivider>Current Seasons</SectionDivider>
                              <ul className="space-y-3 list-none p-0 m-0">
                                {groupedSeasons.currentLike.map((s) => (
                                  <SeasonRow key={s.id} s={s} onEdit={() => startEditSeason(s)} />
                                ))}
                              </ul>
                            </>
                          )}
                          {groupedSeasons.prev.length > 0 && (
                            <>
                              <SectionDivider>Previous Seasons</SectionDivider>
                              <ul className="space-y-3 list-none p-0 m-0">
                                {groupedSeasons.prev.map((s) => (
                                  <SeasonRow key={s.id} s={s} onEdit={() => startEditSeason(s)} />
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </section>
              )}

              {activeTab === 'schedule' && (
                <>
                {/* ── Existing scheduled drafts ─────────────────────────── */}
                {scheduledEntries.length > 0 && (
                  <section
                    className="flex w-full flex-col gap-4 rounded-lg px-3 pb-6 pt-5 text-greyscale-blue-100 md:px-6"
                    style={{ background: '#0E0E0F', boxShadow: '0px 0px 6px #3B0394' }}
                  >
                    <HeaderIcon3
                      title="Scheduled Drafts"
                      icon={<CalendarDays className="w-5 h-5 text-[#907AFF]" aria-hidden />}
                    />
                    <div className="flex flex-col gap-3">
                      {scheduledEntries.map((entry) => {
                        const dt = entry.scheduled_at ? new Date(entry.scheduled_at) : null;
                        const isEditing = editingEntryId === entry.id;
                        const playerCount = entry.player_ids?.length || members.length;
                        return (
                          <div
                            key={entry.id}
                            className="flex flex-wrap items-center gap-3 rounded-[6px] px-4 py-3"
                            style={{
                              background: isEditing ? 'rgba(113, 66, 255, 0.12)' : '#1A1A1D',
                              outline: isEditing ? '1px solid #7142FF' : '1px solid #2E2C32',
                              outlineOffset: '-1px',
                            }}
                          >
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="truncate text-sm font-semibold text-greyscale-blue-100 font-brockmann">
                                {entry.draft_type === 'spec-draft'
                                  ? 'Special Draft'
                                  : entry.theme?.trim() || entry.draft_type || 'Draft'}
                              </span>
                              <div className="flex flex-wrap items-center gap-3">
                                {dt && (
                                  <span className="text-xs text-[#907AFF] font-brockmann">
                                    {format(dt, "MMM d 'at' h:mm a")}
                                  </span>
                                )}
                                <span className="text-xs text-greyscale-blue-400 font-brockmann">
                                  {playerCount} {playerCount === 1 ? 'player' : 'players'}
                                </span>
                                <span
                                  className="text-[10px] font-medium px-2 py-0.5 rounded-full font-brockmann"
                                  style={
                                    entry.is_multiplayer
                                      ? { background: 'rgba(20,84,96,0.5)', color: '#B2FFEA', outline: '0.5px solid #B2FFEA', outlineOffset: '-0.5px' }
                                      : { background: 'rgba(88,40,120,0.5)', color: '#EDEBFF', outline: '0.5px solid #EDEBFF', outlineOffset: '-0.5px' }
                                  }
                                >
                                  {entry.is_multiplayer ? 'Multiplayer' : 'Local'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isEditing) {
                                    resetScheduleForm();
                                  } else {
                                    setSearchParams((prev) => {
                                      const p = new URLSearchParams(prev);
                                      p.set('tab', 'schedule');
                                      p.set('edit', entry.id);
                                      return p;
                                    }, { replace: true });
                                  }
                                }}
                                className="flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-xs font-medium text-greyscale-blue-200 transition-colors hover:bg-white/10 font-brockmann"
                                style={{ outline: '1px solid #49474B', outlineOffset: '-1px' }}
                              >
                                <Pencil className="w-3 h-3" />
                                {isEditing ? 'Cancel' : 'Edit'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEntryToDelete(entry.id)}
                                className="flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 font-brockmann"
                                style={{ outline: '1px solid rgba(239,68,68,0.3)', outlineOffset: '-1px' }}
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                <section
                  className="flex w-full flex-col gap-6 rounded-lg px-3 pb-8 pt-6 text-greyscale-blue-100 md:px-6"
                  style={{ background: '#0E0E0F', boxShadow: '0px 0px 6px #3B0394' }}
                >
                  <div className="flex flex-col gap-8 w-full">
                    <div className="flex flex-col gap-[18px]">
                      <HeaderIcon3
                        title={editingEntryId ? 'Edit Scheduled Draft' : 'Schedule a Draft'}
                        icon={<CalendarDays className="w-5 h-5 text-[#907AFF]" aria-hidden />}
                      />
                      <div className="flex flex-col lg:flex-row gap-4 items-start w-full">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full lg:flex-1 lg:min-w-0">
                          <div className="flex flex-col gap-[9px] pt-[3px] min-w-0">
                            <Label className="text-[#BDC3C2] text-sm font-medium leading-5 font-brockmann m-0 flex items-center gap-2">
                              <CalendarDays className="w-4 h-4 text-[#907AFF] shrink-0" aria-hidden />
                              Date
                            </Label>
                            <Input
                              type="date"
                              value={schedDatePart}
                              onChange={(e) => setSchedDatePart(e.target.value)}
                              className={cn(draftInputClass, 'date-input-icon-light px-4 py-3 min-h-12')}
                              style={draftFieldOutline}
                            />
                          </div>
                          <div className="flex flex-col gap-[9px] pt-[3px] min-w-0">
                            <Label className="text-[#BDC3C2] text-sm font-medium leading-5 font-brockmann m-0 flex items-center gap-2">
                              <Clock className="w-4 h-4 text-[#907AFF] shrink-0" aria-hidden />
                              Time
                            </Label>
                            <Input
                              type="time"
                              value={schedTimePart}
                              onChange={(e) => setSchedTimePart(e.target.value)}
                              className={cn(draftInputClass, 'date-input-icon-light px-4 py-3 min-h-12')}
                              style={draftFieldOutline}
                            />
                          </div>
                        </div>
                        {seasons.length > 0 && (
                          <div className="flex flex-col gap-[9px] pt-[3px] w-full lg:flex-1 lg:min-w-0">
                            <Label className="text-[#BDC3C2] text-sm font-medium leading-5 font-brockmann m-0">
                              Season <span className="font-normal text-greyscale-blue-500">Optional</span>
                            </Label>
                            <Select value={schedSeason} onValueChange={setSchedSeason}>
                              <SelectTrigger className={draftSelectTriggerClass} style={draftFieldOutline}>
                                <SelectValue placeholder="Previous Seasons" />
                              </SelectTrigger>
                              <SelectContent className="bg-greyscale-purp-850 border-[#49474B] text-greyscale-blue-100">
                                <SelectItem value="none">No season</SelectItem>
                                {seasons.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col items-center gap-2">
                        <h3 className="text-greyscale-blue-100 text-2xl font-bold leading-8 tracking-[0.96px] font-brockmann text-center m-0">
                          Choose The Draft Theme
                        </h3>
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch gap-4 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setScheduleSlice('filmography')}
                          className={cn(
                            'flex-1 h-20 min-h-[80px] w-full min-w-[min(100%,294px)] px-4 sm:px-9 py-2 rounded-[6px] flex justify-center items-center gap-4 text-lg font-medium transition-colors font-brockmann',
                            scheduleSlice === 'filmography'
                              ? 'bg-brand-primary text-greyscale-blue-100'
                              : 'bg-greyscale-purp-850 hover:bg-greyscale-purp-800 active:bg-purple-800 text-greyscale-blue-100',
                          )}
                          style={
                            scheduleSlice !== 'filmography'
                              ? { outline: '1px solid #49474B', outlineOffset: '-1px' }
                              : undefined
                          }
                        >
                          <PersonIcon className="w-6 h-6 shrink-0" />
                          <span>Draft by Filmography</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setScheduleSlice('year')}
                          className={cn(
                            'flex-1 h-20 min-h-[80px] w-full min-w-[min(100%,294px)] px-4 sm:px-9 py-2 rounded-[6px] flex justify-center items-center gap-4 text-lg font-medium transition-colors font-brockmann',
                            scheduleSlice === 'year'
                              ? 'bg-brand-primary text-greyscale-blue-100'
                              : 'bg-greyscale-purp-850 hover:bg-greyscale-purp-800 active:bg-purple-800 text-greyscale-blue-100',
                          )}
                          style={
                            scheduleSlice !== 'year'
                              ? { outline: '1px solid #49474B', outlineOffset: '-1px' }
                              : undefined
                          }
                        >
                          <CalendarIcon className="w-6 h-6 shrink-0" />
                          <span>Draft by Year</span>
                        </button>
                      </div>
                      <details className="text-sm text-purple-300/90">
                        <summary className="cursor-pointer select-none font-medium text-purple-200 hover:text-white">
                          Classic or special draft instead
                        </summary>
                        <div className="mt-4 space-y-3 pl-2 border-l-2 border-purple-500/30">
                          <div className="flex flex-wrap gap-3 items-center">
                            <Label className="text-greyscale-blue-300 text-xs whitespace-nowrap m-0">Type</Label>
                            <Select
                              value={altDraftType}
                              onValueChange={(v) => setAltDraftType(v as 'classic' | 'spec-draft')}
                            >
                              <SelectTrigger className={cn(draftSelectTriggerClass, 'max-w-[220px]')} style={draftFieldOutline}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-greyscale-purp-850 border-[#49474B] text-greyscale-blue-100">
                                <SelectItem value="classic">Classic draft</SelectItem>
                                <SelectItem value="spec-draft">Special draft</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-purple-500/40"
                              onClick={() => setScheduleSlice('alternate')}
                            >
                              Use this type
                            </Button>
                          </div>
                          {scheduleSlice === 'alternate' && altDraftType === 'spec-draft' && (
                            <div className="space-y-2 max-w-lg">
                              <Label className="text-[#BDC3C2] text-sm font-medium font-brockmann m-0">
                                Special draft pool
                              </Label>
                              <Select value={specDraftId} onValueChange={setSpecDraftId}>
                                <SelectTrigger className={draftSelectTriggerClass} style={draftFieldOutline}>
                                  <SelectValue placeholder="Select a published special draft…" />
                                </SelectTrigger>
                                <SelectContent className="bg-greyscale-purp-850 border-[#49474B] text-greyscale-blue-100">
                                  {(specSummaries.length ? specSummaries : []).map((row) => (
                                    <SelectItem key={row.id} value={row.id}>
                                      {row.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-greyscale-blue-400 m-0">
                                Members will start this draft from the special-draft setup flow linked to your schedule.
                              </p>
                            </div>
                          )}
                          {scheduleSlice === 'alternate' && altDraftType === 'classic' && (
                            <p className="text-xs text-greyscale-blue-400 m-0 max-w-lg">
                              Classic drafts use the standard picker without a fixed filmmaker or era theme.
                            </p>
                          )}
                        </div>
                      </details>
                    </div>

                    {scheduleSlice === 'filmography' && (
                      <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-3">
                          <HeaderIcon3
                            title="Search for a Person"
                            icon={<PersonIcon className="w-5 h-5 text-[#907AFF]" aria-hidden />}
                          />
                          <div className="relative w-full">
                            <Search
                              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#BDC3C2] pointer-events-none"
                              aria-hidden
                            />
                            <Input
                              value={personSearch}
                              onChange={(e) => setPersonSearch(e.target.value)}
                              placeholder="Search for actors, directors..."
                              className={cn(draftInputClass, 'pl-12 pr-4 py-3')}
                              style={draftFieldOutline}
                            />
                          </div>
                        </div>
                        {(peopleSearching || personSearch.trim().length >= 2) && (
                          <div className="max-h-64 overflow-y-auto flex flex-col gap-2">
                            {peopleSearching && (
                              <p className="text-sm text-greyscale-blue-500 m-0 font-brockmann">Searching…</p>
                            )}
                            {personSearch.trim().length >= 2 && !peopleSearching && personResults.length === 0 && (
                              <p className="text-sm text-greyscale-blue-500 m-0 font-brockmann">No people found</p>
                            )}
                            {personSearch.trim().length >= 2
                              && personResults.map((person) => {
                                const isSelected = selectedPerson?.id === person.id;
                                return (
                                  <button
                                    key={person.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedPerson(person as PersonRow);
                                      setPersonSearch('');
                                    }}
                                    className={cn(
                                      'w-full py-4 px-4 pr-6 rounded cursor-pointer transition-colors flex items-start gap-4 text-left',
                                      'bg-greyscale-purp-850 hover:bg-greyscale-purp-800 active:bg-purple-800 text-greyscale-blue-100',
                                    )}
                                    style={
                                      isSelected
                                        ? { outline: '2px solid #7142FF', outlineOffset: '-1px' }
                                        : { outline: '1px solid #49474B', outlineOffset: '-1px' }
                                    }
                                  >
                                    <div className="w-12 h-12 overflow-hidden rounded-full flex justify-center items-start shrink-0">
                                      <ActorPortrait
                                        profilePath={person.profile_path}
                                        name={person.name}
                                        size="md"
                                      />
                                    </div>
                                    <div className="flex-1 pb-0.5 flex flex-col justify-start items-start gap-0.5 min-w-0">
                                      <span className="text-greyscale-blue-100 text-base font-semibold leading-6 tracking-[0.32px] font-brockmann">
                                        {person.name}
                                      </span>
                                      <span className="text-greyscale-blue-100/75 text-sm font-normal leading-5 font-brockmann line-clamp-2">
                                        {personSubtitle(person)}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                          </div>
                        )}
                        {personSearch.trim().length > 0 && personSearch.trim().length < 2 && (
                          <p className="text-xs text-greyscale-blue-500 m-0 font-brockmann">
                            Type at least 2 letters to search TMDB credits.
                          </p>
                        )}
                        {selectedPerson && (
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="text-greyscale-blue-100 text-sm font-medium leading-5 font-brockmann">
                              You&apos;ve Selected
                            </span>
                            <span className="text-purple-300 text-2xl font-bold leading-8 tracking-[0.96px] font-brockmann text-center">
                              {selectedPerson.name}
                            </span>
                            <button
                              type="button"
                              className="text-xs text-purple-300 hover:text-white underline font-brockmann mt-1"
                              onClick={() => setSelectedPerson(null)}
                            >
                              Clear selection
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {scheduleSlice === 'year' && (
                      <div className="flex flex-col gap-4">
                        <HeaderIcon3
                          title="Select the year of films you'll draft"
                          icon={<CalendarIcon className="w-5 h-5 text-[#907AFF]" aria-hidden />}
                        />
                        <Input
                          value={yearThemeInput}
                          onChange={(e) => setYearThemeInput(e.target.value)}
                          placeholder="e.g. 1999 / 1960's / Silent era"
                          className={cn(draftInputClass, 'px-4 py-3')}
                          style={draftFieldOutline}
                          maxLength={120}
                        />
                      </div>
                    )}

                    {showScheduleCategories && (
                      <Form {...scheduleCategoryForm}>
                        <EnhancedCategoriesForm
                          form={scheduleCategoryForm}
                          categories={scheduleCategories}
                          theme={scheduleTheme!}
                          playerCount={schedulePlayerCount}
                          selectedOption={scheduleSelectedOption}
                          draftMode="multiplayer"
                        />
                      </Form>
                    )}

                    <div className="flex flex-col gap-3">
                      <Label className="text-[#BDC3C2] text-sm font-medium leading-5 font-brockmann m-0">
                        Draft Format
                      </Label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setSchedIsMultiplayer(false)}
                          className={cn(
                            'flex-1 py-3 px-4 rounded-[6px] flex items-center justify-center gap-2 text-sm font-medium transition-colors font-brockmann',
                            !schedIsMultiplayer
                              ? 'bg-brand-primary text-greyscale-blue-100'
                              : 'bg-greyscale-purp-850 hover:bg-greyscale-purp-800 text-greyscale-blue-100',
                          )}
                          style={schedIsMultiplayer ? { outline: '1px solid #49474B', outlineOffset: '-1px' } : undefined}
                        >
                          <Monitor className="w-4 h-4 shrink-0" aria-hidden />
                          Local
                        </button>
                        <button
                          type="button"
                          onClick={() => setSchedIsMultiplayer(true)}
                          className={cn(
                            'flex-1 py-3 px-4 rounded-[6px] flex items-center justify-center gap-2 text-sm font-medium transition-colors font-brockmann',
                            schedIsMultiplayer
                              ? 'bg-brand-primary text-greyscale-blue-100'
                              : 'bg-greyscale-purp-850 hover:bg-greyscale-purp-800 text-greyscale-blue-100',
                          )}
                          style={!schedIsMultiplayer ? { outline: '1px solid #49474B', outlineOffset: '-1px' } : undefined}
                        >
                          <Wifi className="w-4 h-4 shrink-0" aria-hidden />
                          Multiplayer
                        </button>
                      </div>
                      <p className="text-xs text-greyscale-blue-500 m-0">
                        {schedIsMultiplayer
                          ? 'Each player joins from their own device using an invite code.'
                          : 'Everyone plays together on the same screen in the same room.'}
                      </p>
                    </div>

                    {/* ── Player selection ─────────────────────────── */}
                    {members.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-[#BDC3C2] text-sm font-medium leading-5 font-brockmann m-0">
                            Players in this draft
                          </Label>
                          <button
                            type="button"
                            className="text-xs font-medium text-purple-300 hover:text-white font-brockmann"
                            onClick={() => {
                              if (schedPlayerIds.length === members.length) {
                                setSchedPlayerIds([]);
                              } else {
                                setSchedPlayerIds(members.map((m) => m.user_id));
                              }
                            }}
                          >
                            {schedPlayerIds.length === members.length ? 'Deselect all' : 'Select all'}
                          </button>
                        </div>
                        <p className="text-xs text-greyscale-blue-500 m-0 font-brockmann">
                          {schedPlayerIds.length === members.length
                            ? 'All league members are in this draft.'
                            : `${schedPlayerIds.length} of ${members.length} members selected.`}
                        </p>
                        <div className="flex flex-col gap-2">
                          {membersLoading ? (
                            <p className="text-xs text-greyscale-blue-400 font-brockmann">Loading members…</p>
                          ) : (
                            members.map((member) => {
                              const name = member.profile?.name ?? member.profile?.email ?? 'Player';
                              const selected = schedPlayerIds.includes(member.user_id);
                              return (
                                <button
                                  key={member.user_id}
                                  type="button"
                                  onClick={() => {
                                    setSchedPlayerIds((prev) =>
                                      selected
                                        ? prev.filter((id) => id !== member.user_id)
                                        : [...prev, member.user_id],
                                    );
                                  }}
                                  className={cn(
                                    'flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-left transition-colors font-brockmann',
                                    selected
                                      ? 'bg-[#7142FF]/20'
                                      : 'bg-[#1A1A1D] hover:bg-[#252528]',
                                  )}
                                  style={{
                                    outline: selected ? '1px solid #7142FF' : '1px solid #2E2C32',
                                    outlineOffset: '-1px',
                                  }}
                                >
                                  {/* Checkbox indicator */}
                                  <div
                                    className={cn(
                                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border',
                                      selected
                                        ? 'border-[#7142FF] bg-[#7142FF]'
                                        : 'border-[#49474B] bg-transparent',
                                    )}
                                  >
                                    {selected && <Check className="w-3 h-3 text-white" />}
                                  </div>
                                  {/* Avatar initial */}
                                  <div
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-greyscale-blue-100"
                                    style={{ background: member.role === 'admin' ? '#7142FF' : '#3B2050' }}
                                  >
                                    {name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-sm font-medium text-greyscale-blue-100">
                                      {name}
                                    </span>
                                    {member.role === 'admin' && (
                                      <span className="text-[10px] text-[#907AFF]">Admin</span>
                                    )}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-[9px] pt-[3px]">
                      <Label className="text-[#BDC3C2] text-sm font-medium leading-5 font-brockmann m-0">
                        Notes <span className="font-normal text-greyscale-blue-500">Optional</span>
                      </Label>
                      <Textarea
                        value={schedNotes}
                        onChange={(e) => setSchedNotes(e.target.value)}
                        placeholder="Anything your league should know…"
                        className={cn(draftInputClass, 'resize-none min-h-[88px] px-4 py-3')}
                        style={draftFieldOutline}
                        maxLength={400}
                      />
                    </div>

                  </div>
                </section>

                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {editingEntryId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="border-white/20 bg-transparent text-greyscale-blue-200 hover:bg-white/10 hover:text-greyscale-blue-100 font-brockmann font-medium px-6 py-3 text-base rounded-[2px] min-h-12"
                      onClick={resetScheduleForm}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="lg"
                    className="bg-yellow-500 hover:bg-yellow-300 text-greyscale-blue-800 font-brockmann font-semibold px-6 py-3 text-base rounded-[2px] tracking-wide min-h-12"
                    onClick={handleScheduleDraft}
                    disabled={
                      scheduling
                      || !schedDatePart
                      || !schedTimePart
                      || schedPlayerIds.length === 0
                      || (scheduleSlice === 'filmography' && !selectedPerson)
                      || (scheduleSlice === 'year' && !yearThemeInput.trim())
                      || (scheduleSlice === 'alternate'
                        && altDraftType === 'spec-draft'
                        && !specDraftId)
                    }
                  >
                    <CalendarDays className="w-5 h-5 mr-2" />
                    {scheduling
                      ? (editingEntryId ? 'Updating…' : 'Scheduling…')
                      : (editingEntryId ? 'Update Draft' : 'Schedule Draft')}
                  </Button>
                </div>
                </>
              )}

              {activeTab === 'invite' && (
                <>
                  <section {...shell}>
                    <h2 className="text-xl font-bold text-purple-300 font-brockmann uppercase tracking-wide m-0 mb-6">
                      Invite Members
                    </h2>
                    <p className="text-sm text-greyscale-blue-400 m-0 mb-8 max-w-xl leading-relaxed">
                      Add emails, then send a batch. Invitees receive a league link — they&apos;ll join after signing in or creating an account.
                    </p>

                    <div className="flex max-w-xl flex-col gap-3 sm:flex-row sm:items-stretch">
                      <Input
                        type="email"
                        placeholder="name@example.com"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddEmail();
                          }
                        }}
                        className={cn('w-full min-h-12 flex-1 rounded-[2px]', inputDark)}
                      />
                      <Button
                        type="button"
                        className="h-12 min-h-12 w-full shrink-0 rounded-[2px] bg-[#7142FF] px-4 font-brockmann font-medium text-greyscale-blue-100 hover:bg-[#6338e0] focus-visible:ring-2 focus-visible:ring-purple-400/40 focus-visible:ring-offset-0 focus-visible:ring-offset-transparent sm:w-28"
                        onClick={handleAddEmail}
                        disabled={!emailInput.trim()}
                      >
                        Add
                      </Button>
                    </div>

                    <div className="mt-6 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-400 m-0">
                        Invites ready to send
                      </p>
                      {emailList.length === 0 ? (
                        <p className="text-sm text-greyscale-blue-500 m-0">No addresses queued yet.</p>
                      ) : (
                        <>
                          <ul className="flex flex-wrap gap-3 list-none m-0 p-0 pb-6">
                            {emailList.map((email) => (
                              <li
                                key={email}
                                className="flex items-center gap-2 px-5 py-2 rounded-full bg-purple-950/60 border border-purple-500/50 text-purple-50 text-sm"
                              >
                                <Mail className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                <span className="font-medium truncate max-w-[200px]" title={email}>{email}</span>
                                <button
                                  type="button"
                                  className="p-1 rounded-full hover:bg-white/10 text-purple-400 hover:text-white"
                                  aria-label={`Remove ${email}`}
                                  onClick={() =>
                                    setEmailList((prev) => prev.filter((e) => e !== email))
                                  }
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </li>
                            ))}
                          </ul>
                          <Button
                            type="button"
                            className="font-brockmann gap-2"
                            disabled={sendingEmails}
                            onClick={handleSendEmailInvites}
                          >
                            <Send className="w-4 h-4" />
                            {sendingEmails
                              ? 'Sending…'
                              : `Send ${emailList.length} invite${emailList.length !== 1 ? 's' : ''}`}
                          </Button>
                        </>
                      )}
                    </div>
                  </section>

                  <section {...shell}>
                    <h3 className="text-lg font-bold text-greyscale-blue-50 font-brockmann tracking-tight m-0 mb-2 flex items-center gap-2">
                      <Search className="w-5 h-5 text-purple-300" /> Invite by display name
                    </h3>
                    <p className="text-sm text-greyscale-blue-400 m-0 mb-4 leading-relaxed">
                      Search Movie Drafter profiles. Existing members won&apos;t appear.
                    </p>
                    <Input
                      placeholder="Search profiles…"
                      value={userSearch}
                      onChange={(e) => handleUserSearch(e.target.value)}
                      className={cn('max-w-md mb-4', inputDark)}
                    />
                    {searching && <p className="text-xs text-greyscale-blue-400 m-0 mb-3">Searching…</p>}
                    {!searching && userSearch.length >= 2 && searchResults.length === 0 && (
                      <p className="text-xs text-greyscale-blue-400 m-0 mb-3">No users found.</p>
                    )}
                    <ul className="space-y-2 list-none m-0 p-0 max-w-lg">
                      {searchResults.map((result) => (
                        <li
                          key={result.id}
                          className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[#1a1a1d] border border-[#49474B]"
                        >
                          <Avatar className="w-10 h-10 shrink-0">
                            <AvatarImage src={result.photo_url ?? undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(result.display_name)}
                            </AvatarFallback>
                          </Avatar>
                          <p className="text-sm flex-1 truncate m-0 text-greyscale-blue-50">
                            {result.display_name ?? 'Unknown'}
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 border-purple-500/40 text-purple-200 hover:bg-purple-950/40"
                            onClick={() => handleInviteUser(result.id)}
                            disabled={sendingInvite === result.id}
                          >
                            {sendingInvite === result.id ? 'Sending…' : 'Invite'}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section {...shell}>
                    <h3 className="text-lg font-bold text-greyscale-blue-50 font-brockmann tracking-tight m-0 mb-6">
                      Current Members
                    </h3>
                    {membersLoading ? (
                      <p className="text-sm text-greyscale-blue-300 m-0">Loading…</p>
                    ) : (
                      <ul className="divide-y divide-white/10 border border-[#49474B] rounded-lg overflow-hidden bg-[#121214] list-none m-0 p-0">
                        {members.map((member) => (
                          <li key={member.id} className="flex items-center gap-4 px-4 py-4">
                            <Avatar className="w-11 h-11 shrink-0">
                              <AvatarImage src={member.profile?.avatar_url ?? undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(member.profile?.name)}
                              </AvatarFallback>
                            </Avatar>
                            <p className="text-sm flex-1 truncate text-greyscale-blue-50 m-0 font-medium">
                              {member.profile?.name ?? member.profile?.email ?? 'Unknown'}
                            </p>
                            {member.role === 'admin' ? (
                              <Badge
                                variant="outline"
                                className="flex items-center gap-1 border-purple-500/40 bg-purple-950/40 text-purple-200 shrink-0"
                              >
                                <Crown className="w-3 h-3" /> Admin
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-error-red-400 hover:bg-error-red-500/10 shrink-0 gap-2"
                                onClick={() => setMemberToRemove(member.user_id)}
                              >
                                <UserMinus className="w-4 h-4" />
                                Remove
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={!!memberToRemove} onOpenChange={(o) => !o && setMemberToRemove(null)}>
        <AlertDialogContent className="bg-[#161618] border-[#49474B] text-greyscale-blue-50">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access to this league and its standings history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!entryToDelete} onOpenChange={(o) => !o && setEntryToDelete(null)}>
        <AlertDialogContent className="bg-[#161618] border-[#49474B] text-greyscale-blue-50">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove scheduled draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the scheduled draft entry. Members will lose their upcoming-draft notification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteScheduledEntry}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!seasonToDelete} onOpenChange={(o) => !o && setSeasonToDelete(null)}>
        <AlertDialogContent className="bg-[#161618] border-[#49474B] text-greyscale-blue-50">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{seasonToDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Drafts linked to this season will stay in the league but won&apos;t roll up under this period anymore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSeason}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete season
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

function SeasonRow({
  s,
  onEdit,
}: {
  s: LeagueSeason;
  onEdit: () => void;
}) {
  return (
    <li className="flex items-center gap-4 rounded-lg border border-[#49474B] bg-[#1D1D1F] px-4 py-4">
      <div className="min-w-0 flex-1">
        <p className="font-brockmann font-medium text-white text-[18px] leading-[26px] tracking-tight m-0 mb-2 truncate">
          {s.name}
        </p>
        <div className="flex flex-wrap gap-x-2 gap-y-1 text-[13px] text-greyscale-blue-400">
          <span className="text-greyscale-blue-500">Begins</span>
          <span className="font-medium text-greyscale-blue-200">
            {format(new Date(s.starts_at), 'MM/dd/y')}
          </span>
          <span className="text-greyscale-blue-600 mx-1">·</span>
          <span className="text-greyscale-blue-500">Ends</span>
          <span className="font-medium text-greyscale-blue-200">
            {format(new Date(s.ends_at), 'MM/dd/y')}
          </span>
        </div>
      </div>
      <button
        type="button"
        className="p-2 shrink-0 rounded text-greyscale-blue-400 hover:text-purple-300 hover:bg-white/10"
        aria-label={`Edit ${s.name}`}
        onClick={onEdit}
      >
        <Pencil className="w-[18px] h-[18px]" />
      </button>
    </li>
  );
}

export default LeagueSettings;
