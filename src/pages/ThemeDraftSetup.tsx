import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, User, Mail } from 'lucide-react';
import { MultiPersonIcon, EmailIcon, TrashIcon } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useMultiplayerDraft } from '@/hooks/useMultiplayerDraft';
import { useProfile } from '@/hooks/useProfile';
import { useDraftCategories } from '@/hooks/useDraftCategories';
import EnhancedCategoriesForm from '@/components/EnhancedCategoriesForm';
import { Form } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { DraftSetupForm } from '@/hooks/useDraftForm';

const isEmailValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

interface ThemeDraftSetupProps {
  theme: 'people' | 'year';
}

const ThemeDraftSetup = ({ theme }: ThemeDraftSetupProps) => {
  const params = useParams<{ name?: string; year?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { participantId, loading: sessionLoading } = useCurrentUser();
  const { createMultiplayerDraft, loading: creatingDraft } = useMultiplayerDraft();
  const { getDisplayName, loading: profileLoading } = useProfile();

  const option = useMemo(() => {
    if (theme === 'people' && params.name) {
      try {
        return decodeURIComponent(params.name);
      } catch {
        return params.name;
      }
    }
    if (theme === 'year' && params.year) return params.year;
    return '';
  }, [theme, params.name, params.year]);

  const [draftMode, setDraftMode] = useState<'local' | 'multiplayer'>('local');
  const [participants, setParticipants] = useState<string[]>([]);
  const [newParticipant, setNewParticipant] = useState('');
  const [isAddButtonHovered, setIsAddButtonHovered] = useState(false);
  const [hoveredRemoveButton, setHoveredRemoveButton] = useState<string | null>(null);

  const canCreateMultiplayer = !!participantId;
  const isPreparingSession = draftMode === 'multiplayer' && (sessionLoading || !canCreateMultiplayer);

  const hostName = useMemo(() => {
    if (profileLoading) return '';
    return getDisplayName();
  }, [getDisplayName, profileLoading]);

  const categories = useDraftCategories(theme);

  const form = useForm<DraftSetupForm>({
    defaultValues: { participants: [], categories: [] },
  });

  useEffect(() => {
    if (!option) {
      navigate('/', { replace: true });
    }
  }, [option, navigate]);

  useEffect(() => {
    if (draftMode === 'multiplayer' && hostName && !participants.includes(hostName)) {
      setParticipants((prev) => [hostName, ...prev]);
    } else if (draftMode === 'local' && hostName) {
      setParticipants((prev) => prev.filter((p) => p !== hostName));
    }
  }, [draftMode, hostName]);

  const handleAddParticipant = () => {
    const trimmed = newParticipant.trim();
    if (trimmed && !participants.includes(trimmed)) {
      setParticipants((prev) => [...prev, trimmed]);
      setNewParticipant('');
    }
  };

  const handleRemoveParticipant = (participant: string) => {
    if (draftMode === 'multiplayer' && participant === hostName) {
      toast({
        title: 'Cannot remove host',
        description: 'The host must remain as a participant in multiplayer drafts.',
        variant: 'default',
      });
      return;
    }
    setParticipants((prev) => prev.filter((p) => p !== participant));
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    if (!option || !data.categories.length) {
      toast({
        title: 'Error',
        description: 'Please select at least one category',
        variant: 'destructive',
      });
      return;
    }

    if (draftMode === 'local') {
      if (participants.length < 2) {
        toast({
          title: 'Not Enough Participants',
          description: 'Please add at least 2 participants to create a local draft.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (draftMode === 'multiplayer') {
      const invalidEmails = participants.filter((p) => p !== hostName && !isEmailValid(p));
      if (invalidEmails.length > 0) {
        toast({
          title: 'Invalid Email Addresses',
          description: `Please enter valid email addresses for: ${invalidEmails.join(', ')}`,
          variant: 'destructive',
        });
        return;
      }
      if (!participantId) {
        toast({
          title: 'Session not ready',
          description: 'Please wait a moment for your session to load, then try again.',
          variant: 'destructive',
        });
        return;
      }

      const additionalParticipants = participants.filter((p) => p !== hostName);
      const draftId = await createMultiplayerDraft({
        title: option,
        theme,
        option,
        categories: data.categories,
        participantEmails: additionalParticipants,
      });
      navigate(`/draft/${draftId}`);
      return;
    }

    navigate('/draft', {
      state: {
        theme,
        option,
        participants,
        categories: data.categories,
        isMultiplayer: false,
      },
    });
  });

  if (!option) {
    return null;
  }

  const setupUrl =
    theme === 'people'
      ? `/draft/people/${encodeURIComponent(option)}/setup`
      : `/draft/year/${option}/setup`;

  const pageTitle = `Setup draft – ${option}`;

  return (
    <>
      <Helmet>
        <title>Movie Drafter - {pageTitle}</title>
        <meta name="description" content={`Set up your ${theme === 'people' ? 'person' : 'year'} movie draft: ${option}. Choose participants and categories.`} />
        <link rel="canonical" href={`https://moviedrafter.com${setupUrl}`} />
      </Helmet>
      <div className="min-h-screen" style={{ background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)' }}>
        <style>{`
          input::placeholder {
            color: var(--Text-Light-grey, #BDC3C2) !important;
          }
        `}</style>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="w-full flex flex-col gap-2">
              <Link
                to="/"
                className="text-greyscale-blue-300 hover:text-greyscale-blue-100 text-sm font-brockmann self-start"
              >
                ← Change {theme === 'people' ? 'person' : 'year'}
              </Link>
            </div>

            <div className="w-full flex flex-col gap-4 items-center justify-center py-6">
              <div className="uppercase" style={{ fontFamily: 'Brockmann', fontWeight: 500, fontSize: '32px', lineHeight: '36px', letterSpacing: '1.28px', color: 'var(--Text-Primary, #FCFFFF)' }}>
                SETTING UP
              </div>
              <div className="text-brand-primary uppercase text-center w-full" style={{ fontFamily: 'CHANEY', fontWeight: 400, fontSize: '64px', lineHeight: '64px' }}>
                {option.toUpperCase()}
              </div>
            </div>

            {/* Select Draft Mode */}
            <div className="w-full p-6 bg-greyscale-purp-900 rounded-[8px] flex flex-col gap-6" style={{ boxShadow: '0px 0px 6px #3B0394' }}>
              <div className="self-stretch flex flex-col justify-center items-center gap-2">
                <div className="text-greyscale-blue-100 text-2xl font-bold leading-8 tracking-wide font-brockmann">
                  Select A Mode
                </div>
              </div>
              <div className="self-stretch flex flex-col sm:flex-row items-stretch sm:items-start gap-4">
                <button
                  type="button"
                  onClick={() => setDraftMode('local')}
                  className={`flex-1 h-20 min-h-[80px] w-full sm:min-w-[294px] px-4 sm:px-9 py-2 rounded-[6px] flex justify-center items-center gap-4 text-lg font-medium transition-colors ${
                    draftMode === 'local' ? 'bg-brand-primary text-greyscale-blue-100' : 'bg-greyscale-purp-850 text-greyscale-blue-100 hover:bg-greyscale-purp-800 active:bg-purple-800'
                  }`}
                  style={{
                    height: '80px',
                    ...(draftMode !== 'local' ? { outline: '1px solid #49474B', outlineOffset: '-1px' } : {}),
                  }}
                >
                  <User className="w-6 h-6" />
                  <span className="font-brockmann">Local Draft</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDraftMode('multiplayer')}
                  className={`flex-1 h-20 min-h-[80px] w-full sm:min-w-[294px] px-4 sm:px-9 py-2 rounded-[6px] flex justify-center items-center gap-4 text-lg font-medium transition-colors ${
                    draftMode === 'multiplayer' ? 'bg-brand-primary text-greyscale-blue-100' : 'bg-greyscale-purp-850 text-greyscale-blue-100 hover:bg-greyscale-purp-800 active:bg-purple-800'
                  }`}
                  style={{
                    height: '80px',
                    ...(draftMode !== 'multiplayer' ? { outline: '1px solid #49474B', outlineOffset: '-1px' } : {}),
                  }}
                >
                  <Users className="w-6 h-6" />
                  <span className="font-brockmann">Online Multiplayer</span>
                </button>
              </div>
              {draftMode === 'multiplayer' && (
                <div className="self-stretch p-4 bg-teal-900 rounded flex flex-col" style={{ outline: '1px solid #B2FFEA', outlineOffset: '-1px' }}>
                  <span className="text-teal-200 text-sm font-medium leading-5 font-brockmann">
                    <span className="font-bold">Multiplayer Mode:</span> Enter email addresses of friends you want to invite. They'll receive an email invitation to join your draft.
                  </span>
                </div>
              )}
            </div>

            {/* Add Participants */}
            <div className="p-6 bg-greyscale-purp-900 rounded-[8px] flex flex-col gap-6" style={{ boxShadow: '0px 0px 6px #3B0394' }}>
              <div className="flex items-center gap-2">
                <MultiPersonIcon className="w-6 h-6 text-purple-300" />
                <span className="text-greyscale-blue-100 text-xl font-brockmann font-medium leading-7">
                  Add Participants
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder={draftMode === 'multiplayer' ? 'Enter participant email...' : 'Enter participant name...'}
                  value={newParticipant}
                  onChange={(e) => setNewParticipant(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddParticipant())}
                  className="flex-1 rounded-[2px] bg-greyscale-purp-850 text-greyscale-blue-100 placeholder:text-greyscale-blue-500 border-0 focus:border-0"
                  style={{ outline: '1px solid #666469', outlineOffset: '-1px' }}
                />
                <button
                  type="button"
                  onClick={handleAddParticipant}
                  onMouseEnter={() => setIsAddButtonHovered(true)}
                  onMouseLeave={() => setIsAddButtonHovered(false)}
                  className="px-4 py-2 bg-brand-primary text-greyscale-blue-100 text-sm font-brockmann font-medium leading-5 rounded-[2px] flex justify-center items-center transition-colors"
                  style={{
                    background: isAddButtonHovered ? 'var(--Purple-300, #907AFF)' : 'var(--Brand-Primary, #7142FF)',
                  }}
                >
                  Add
                </button>
              </div>
              {draftMode === 'multiplayer' && (
                <div className="p-4 bg-teal-900 rounded flex items-center gap-2" style={{ outline: '1px solid #B2FFEA', outlineOffset: '-1px' }}>
                  <EmailIcon className="w-6 h-6 text-teal-200" />
                  <span className="text-teal-200 text-sm font-brockmann font-medium leading-5">
                    <span className="font-bold">Multiplayer Mode:</span> Enter email addresses of friends you want to invite. They'll receive an email invitation to join.
                  </span>
                </div>
              )}
              {(participants.length > 0 || (draftMode === 'multiplayer' && hostName)) && (
                <div className="flex flex-col gap-3">
                  <span className="text-greyscale-blue-300 text-base font-normal leading-6 font-brockmann">
                    Participants (
                    {draftMode === 'multiplayer' && hostName
                      ? participants.filter((p) => p !== hostName).length + 1
                      : participants.length}
                    ):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {draftMode === 'multiplayer' && hostName && (
                      <div className="py-2 pl-4 pr-4 bg-brand-primary rounded flex items-center gap-2" title="Host (cannot be removed)">
                        <Mail size={16} className="text-greyscale-blue-100" />
                        <span className="text-greyscale-blue-100 text-sm font-brockmann font-medium leading-5">
                          {hostName} (Host)
                        </span>
                      </div>
                    )}
                    {participants.filter((p) => draftMode !== 'multiplayer' || p !== hostName).map((participant) => (
                      <div
                        key={participant}
                        className={`py-2 pl-4 pr-[10px] bg-brand-primary rounded flex items-center gap-2 ${
                          draftMode === 'multiplayer' && !isEmailValid(participant) && participant !== hostName ? 'bg-red-900 border border-red-500' : ''
                        }`}
                      >
                        {draftMode === 'multiplayer' && <Mail size={16} className="text-greyscale-blue-100" />}
                        <span className="text-greyscale-blue-100 text-sm font-brockmann font-medium leading-5">{participant}</span>
                        {draftMode === 'multiplayer' && participant !== hostName && !isEmailValid(participant) && (
                          <span className="text-xs text-red-400 ml-1">Invalid</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveParticipant(participant)}
                          onMouseEnter={() => setHoveredRemoveButton(participant)}
                          onMouseLeave={() => setHoveredRemoveButton(null)}
                          className="p-1 rounded-xl flex justify-center items-center hover:bg-purple-300 transition-colors"
                          style={{ background: hoveredRemoveButton === participant ? 'var(--Purple-300, #907AFF)' : 'transparent' }}
                        >
                          <TrashIcon className="w-4 h-4 text-greyscale-blue-100" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Categories */}
            <Form {...form}>
              <form onSubmit={handleSubmit} className="space-y-8">
                <EnhancedCategoriesForm
                  form={form}
                  categories={categories}
                  theme={theme}
                  playerCount={Math.max(participants.length, draftMode === 'multiplayer' ? 2 : 1)}
                  selectedOption={option}
                  draftMode={draftMode === 'local' ? 'single' : 'multiplayer'}
                  participants={participants}
                />
                <div className="text-center">
                  <Button
                    type="submit"
                    disabled={creatingDraft || isPreparingSession}
                    className="bg-yellow-500 hover:bg-yellow-300 text-greyscale-blue-800 font-brockmann font-semibold px-6 py-3 text-base rounded-[2px] tracking-wide"
                    size="lg"
                  >
                    {isPreparingSession ? 'Preparing session...' : creatingDraft ? 'Creating...' : draftMode === 'multiplayer' ? 'Create Multiplayer Draft' : 'Start Draft'}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </>
  );
};

export default ThemeDraftSetup;
