import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, User, Mail, Bot } from 'lucide-react';
import {
  PersonIcon,
  CalendarIcon,
  EmailIcon,
  MultiPersonIcon,
  TrashIcon,
} from '@/components/icons';
import { usePeopleSearch } from '@/hooks/usePeopleSearch';
import { ActorPortrait } from '@/components/ActorPortrait';
import { useDraftCategories } from '@/hooks/useDraftCategories';
import EnhancedCategoriesForm from '@/components/EnhancedCategoriesForm';
import { JoinDraftForm } from '@/components/JoinDraftForm';
import { SpecDraftSelector } from '@/components/SpecDraftSelector';
import { HeaderIcon3 } from '@/components/HeaderIcon3';
import { Form } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { useDraftForm, DraftSetupForm } from '@/hooks/useDraftForm';
import { Participant } from '@/types/participant';
import { getRandomAIName } from '@/data/aiNames';
import { cn } from '@/lib/utils';

export interface HomeDraftSectionProps {
  leagueId?: string | null;
  draftSetupAnchorId?: string | null;
  className?: string;
  innerClassName?: string;
}

export function themeDraftSetupLocation(
  theme: 'people' | 'year',
  option: string,
  leagueId?: string | null,
): string {
  const base =
    theme === 'people'
      ? `/draft/people/${encodeURIComponent(option)}/setup`
      : `/draft/year/${encodeURIComponent(option)}/setup`;
  const lid = leagueId?.trim();
  if (!lid) return base;
  return `${base}?league=${encodeURIComponent(lid)}`;
}

export function HomeDraftSection({
  leagueId = null,
  draftSetupAnchorId = null,
  className,
  innerClassName,
}: HomeDraftSectionProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    state: { theme, searchQuery, selectedOption, participants, newParticipant, draftMode },
    isStepVisible,
    setTheme,
    setSelectedOption,
    setDraftMode,
    setSearchQuery,
    setNewParticipant,
    addParticipant,
    addAIParticipant,
    removeParticipant,
    isEmailValid,
  } = useDraftForm();

  const form = useForm<DraftSetupForm>({
    defaultValues: { participants: [], categories: [] },
  });

  const { people, loading: peopleLoading } = usePeopleSearch(
    theme === 'people' ? searchQuery : '',
  );

  const categories = useDraftCategories(theme || null);

  const years = (() => {
    const ys: string[] = [];
    for (let y = 2025; y >= 1939; y--) ys.push(y.toString());
    return ys;
  })();

  const handleAddParticipant = () => {
    addParticipant(newParticipant);
  };

  const handleAddAIParticipant = () => {
    addAIParticipant(getRandomAIName());
  };

  const handleRemoveParticipant = (participant: string | Participant) => {
    removeParticipant(participant);
  };

  const handleStartDraft = (data: DraftSetupForm) => {
    if (!selectedOption || !data.categories.length) return;

    if (draftMode === 'single') {
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
      const humanParticipants = participants.filter((p) => !p.isAI);
      const invalidEmails = humanParticipants.filter((p) => !isEmailValid(p.name));
      if (invalidEmails.length > 0) {
        toast({
          title: 'Invalid Email Addresses',
          description:
            `Please enter valid email addresses for: ${invalidEmails.map((p) => p.name).join(', ')}`,
          variant: 'destructive',
        });
        return;
      }
    }

    navigate('/draft', {
      state: {
        theme,
        option: selectedOption,
        participants,
        categories: data.categories,
        isMultiplayer: draftMode === 'multiplayer',
        ...(draftMode === 'single' ? { forceNewDraft: true } : {}),
      },
    });
  };

  const handleOptionSelect = (option: string | { title: string; profile_path?: string }) => {
    if (typeof option === 'string') setSelectedOption(option);
    else setSelectedOption(option.title);
    setSearchQuery('');
  };

  const handleYearSelect = (year: string) => {
    setSelectedOption(year);
  };

  const shouldShowResults = theme === 'people' && searchQuery.trim().length > 0;

  return (
    <div className={cn('container mx-auto px-4 pt-0 pb-8 relative z-10', className)}>
      <div className={cn('max-w-4xl mx-auto space-y-8', innerClassName)}>
      {/* Join Existing Draft + Start a Special Draft */}
      {/* Grid: equal row heights; minmax(0,1fr) avoids overflow in narrow columns */}
      <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-stretch">
        <JoinDraftForm className="min-h-0 h-full min-w-0" />
        <SpecDraftSelector className="min-h-0 h-full min-w-0" />
      </div>

      {/* Theme selection */}
      <div
        {...(draftSetupAnchorId ? { id: draftSetupAnchorId } : {})}
        className={cn('w-full p-6 bg-greyscale-purp-900 rounded-[8px] flex flex-col gap-6', draftSetupAnchorId && 'scroll-mt-24')}
        style={{ boxShadow: '0px 0px 6px #3B0394' }}
      >
        <div className="self-stretch flex flex-col justify-center items-center gap-2">
          <h2 className="text-greyscale-blue-100 text-2xl font-bold leading-8 tracking-wide font-brockmann text-center m-0">
            Setup Your Own Draft Now
          </h2>
        </div>
        <div className="self-stretch flex flex-col sm:flex-row items-stretch sm:items-start gap-4">
          <button
            onClick={() => {
              setTheme('people');
              setSelectedOption('');
              setSearchQuery('');
            }}
            className={`flex-1 h-20 min-h-[80px] w-full sm:min-w-[294px] px-4 sm:px-9 py-2 rounded-[6px] flex justify-center items-center gap-4 text-lg font-medium transition-colors ${
              theme === 'people'
                ? 'bg-brand-primary text-greyscale-blue-100'
                : 'bg-greyscale-purp-850 hover:bg-greyscale-purp-800 active:bg-purple-800 text-greyscale-blue-100'
            }`}
            style={{
              height: '80px',
              ...(theme !== 'people' ? {outline: '1px solid #49474B', outlineOffset: '-1px'} : {})
            }}
          >
            <div className="w-6 h-6 flex justify-center items-center">
              <PersonIcon className="w-6 h-6" />
            </div>
            <span className="font-brockmann">Draft by Filmography</span>
          </button>
          <button
            onClick={() => {
              setTheme('year');
              setSelectedOption('');
              setSearchQuery('');
            }}
            className={`flex-1 h-20 min-h-[80px] w-full sm:min-w-[294px] px-4 sm:px-9 py-2 rounded-[6px] flex justify-center items-center gap-4 text-lg font-medium transition-colors ${
              theme === 'year'
                ? 'bg-brand-primary text-greyscale-blue-100'
                : 'bg-greyscale-purp-850 hover:bg-greyscale-purp-800 active:bg-purple-800 text-greyscale-blue-100'
            }`}
            style={{
              height: '80px',
              ...(theme !== 'year' ? {outline: '1px solid #49474B', outlineOffset: '-1px'} : {})
            }}
          >
            <div className="w-6 h-6 flex justify-center items-center">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <span className="font-brockmann">Draft by Year</span>
          </button>
        </div>
      </div>

      {/* Option Selection */}
      {isStepVisible('option') && (
        <div className="p-6 bg-greyscale-purp-900 rounded-[8px] space-y-4" style={{boxShadow: '0px 0px 6px #3B0394'}}>
            <HeaderIcon3 
              title={theme === 'people' ? 'Search Actors, Directors, Writers...' : "Select the year of films you'll draft"} 
              icon={theme === 'people' ? 
                <PersonIcon className="w-6 h-6 text-purple-300" /> : 
                <CalendarIcon className="w-6 h-6 text-purple-300" />
              } 
            />

            {theme === 'people' ? (
              <>
                <Input
                  placeholder="Search actors, directors, writers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-4 rounded-[2px] bg-greyscale-purp-850 text-greyscale-blue-100 placeholder:text-greyscale-blue-500 border-0 focus:border-0"
                  style={{outline: '1px solid #666469', outlineOffset: '-1px'}}
                />


                {shouldShowResults && (
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {peopleLoading ? (
                      <div className="text-greyscale-blue-500">Searching...</div>
                    ) : people.length === 0 ? (
                      <div className="text-greyscale-blue-500">No people found</div>
                    ) : (
                      people.slice(0, 10).map((person) => (
                        <div
                          key={person.id}
                          onClick={() => handleOptionSelect({ title: person.name, profile_path: person.profile_path ?? undefined })}
                          className={`w-full py-4 px-4 pr-6 rounded cursor-pointer transition-colors flex items-start gap-4 ${
                            selectedOption === person.name
                              ? 'bg-greyscale-purp-850 text-greyscale-blue-100'
                              : 'bg-greyscale-purp-850 hover:bg-greyscale-purp-800 active:bg-purple-800 text-greyscale-blue-100'
                          }`}
                          style={selectedOption === person.name 
                            ? {outline: '2px solid #7142FF', outlineOffset: '-1px'}
                            : {outline: '1px solid #49474B', outlineOffset: '-1px'}
                          }
                        >
                          <div className="w-12 h-12 overflow-hidden rounded-full flex justify-center items-start">
                            <ActorPortrait 
                              profilePath={person.profile_path}
                              name={person.name}
                              size="md"
                            />
                          </div>
                          <div className="flex-1 pb-0.5 flex flex-col justify-start items-start gap-0.5">
                            <div className="self-stretch flex flex-col justify-start items-start">
                              <span className="text-greyscale-blue-100 text-lg font-bold leading-[26px] font-brockmann">
                                {person.name}
                              </span>
                            </div>
                            <div className="self-stretch flex flex-col justify-start items-start">
                              <span className="text-greyscale-blue-500 text-sm font-normal leading-5 font-brockmann">
                                {person.known_for_department} • Known for: {person.known_for.slice(0, 2).map(item => item.title).join(', ')}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {selectedOption && (
                  <div className="mb-4 flex flex-col gap-4">
                    <div className="w-full h-full flex-col justify-start items-center gap-1.5 inline-flex">
                      <span className="text-greyscale-blue-100 text-sm font-medium leading-5 font-brockmann">
                        You've Selected
                      </span>
                      <span className="text-purple-300 text-2xl font-bold leading-8 font-brockmann">
                        {selectedOption}
                      </span>
                    </div>
                    <Button
                      type="button"
                      onClick={() => navigate(themeDraftSetupLocation('people', selectedOption, leagueId))}
                      className="bg-yellow-500 hover:bg-yellow-300 text-greyscale-blue-800 font-brockmann font-semibold px-6 py-3 text-base rounded-[2px] tracking-wide w-full sm:w-auto"
                      size="lg"
                    >
                      Begin Setup
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>

                <div className="max-h-60 overflow-y-auto p-2">
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {years.map((year) => (
                      <button
                        key={year}
                        onClick={() => handleYearSelect(year)}
                        className={`h-12 w-full px-2 sm:px-4 md:px-6 py-2 text-sm font-brockmann-medium transition-colors text-greyscale-blue-100 border-0 box-border ${
                          selectedOption === year
                            ? 'bg-brand-primary hover:bg-brand-primary'
                            : 'bg-greyscale-purp-850 hover:bg-greyscale-purp-800'
                        }`}
                        style={{
                          borderRadius: '6px',
                          outline: selectedOption === year ? '0.50px solid #7142FF' : '0.50px solid #666469',
                          outlineOffset: '-0.50px',
                          minWidth: '0',
                          flexShrink: 0
                        }}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedOption && (
                  <div className="w-full flex flex-col justify-start items-center gap-4 mt-4">
                    <div className="w-full flex flex-col justify-start items-center gap-1.5">
                      <span className="text-greyscale-blue-300 text-sm font-brockmann font-medium leading-5">
                        You've Selected
                      </span>
                      <span className="text-purple-300 text-2xl font-brockmann font-bold leading-8 tracking-[0.96px]">
                        {selectedOption}
                      </span>
                    </div>
                    <Button
                      type="button"
                      onClick={() => navigate(themeDraftSetupLocation('year', selectedOption, leagueId))}
                      className="bg-yellow-500 hover:bg-yellow-300 text-greyscale-blue-800 font-brockmann font-semibold px-6 py-3 text-base rounded-[2px] tracking-wide"
                      size="lg"
                    >
                      Begin Setup
                    </Button>
                  </div>
                )}
              </>
            )}
        </div>
      )}

      {/* Draft Mode Selection - only for non-theme flows (people/year use setup page) */}
      {theme !== 'people' && theme !== 'year' && isStepVisible('mode') && (
        <div className="w-full p-6 bg-greyscale-purp-900 rounded-[8px] flex flex-col gap-6" style={{boxShadow: '0px 0px 6px #3B0394'}}>
          <div className="self-stretch flex flex-col justify-center items-center gap-2">
            <h2 className="text-greyscale-blue-100 text-2xl font-bold leading-8 tracking-wide font-brockmann m-0">
              Select A Mode
            </h2>
          </div>
          <div className="self-stretch flex flex-col sm:flex-row items-stretch sm:items-start gap-4">
            <button
              type="button"
              onClick={() => setDraftMode('single')}
              className={`flex-1 h-20 min-h-[80px] w-full sm:min-w-[294px] px-4 sm:px-9 py-2 rounded-[6px] flex justify-center items-center gap-4 text-lg font-medium transition-colors ${
                draftMode === 'single'
                  ? 'bg-brand-primary text-greyscale-blue-100'
                  : 'bg-greyscale-purp-850 text-greyscale-blue-100 hover:bg-greyscale-purp-800 active:bg-purple-800'
              }`}
              style={{
                height: '80px',
                ...(draftMode !== 'single' ? {outline: '1px solid #49474B', outlineOffset: '-1px'} : {})
              }}
            >
              <div className="w-6 h-6 flex justify-center items-center">
                <User className="w-6 h-6" />
              </div>
              <span className="font-brockmann">Local Draft</span>
            </button>
            <button
              type="button"
              onClick={() => setDraftMode('multiplayer')}
              className={`flex-1 h-20 min-h-[80px] w-full sm:min-w-[294px] px-4 sm:px-9 py-2 rounded-[6px] flex justify-center items-center gap-4 text-lg font-medium transition-colors ${
                draftMode === 'multiplayer'
                  ? 'bg-brand-primary text-greyscale-blue-100'
                  : 'bg-greyscale-purp-850 text-greyscale-blue-100 hover:bg-greyscale-purp-800 active:bg-purple-800'
              }`}
              style={{
                height: '80px',
                ...(draftMode !== 'multiplayer' ? {outline: '1px solid #49474B', outlineOffset: '-1px'} : {})
              }}
            >
              <div className="w-6 h-6 flex justify-center items-center">
                <Users className="w-6 h-6" />
              </div>
              <span className="font-brockmann">Online Multiplayer</span>
            </button>
          </div>
          {draftMode === 'multiplayer' && (
            <div className="self-stretch p-4 bg-teal-900 rounded flex flex-col" style={{outline: '1px solid #B2FFEA', outlineOffset: '-1px'}}>
              <p className="self-stretch flex flex-col text-teal-200 text-sm font-medium leading-5 font-brockmann m-0">
                <span className="font-bold">Multiplayer Mode:</span> Enter email addresses of friends you want to invite. They&apos;ll receive an email invitation to join your draft.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Participants */}
      {theme !== 'people' && theme !== 'year' && isStepVisible('participants') && (
        <div className="p-6 bg-greyscale-purp-900 rounded-[8px] flex flex-col gap-6" style={{boxShadow: '0px 0px 6px #3B0394'}}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 flex justify-center items-center">
              <MultiPersonIcon className="w-6 h-6 text-purple-300" />
            </div>
            <h2 className="text-greyscale-blue-100 text-xl font-brockmann font-medium leading-7 m-0">
              Add Participants
            </h2>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder={draftMode === 'multiplayer' ? "Enter participant email..." : "Enter participant name..."}
              value={newParticipant}
              onChange={(e) => setNewParticipant(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddParticipant()}
              className="rounded-[2px] bg-greyscale-purp-850 text-greyscale-blue-100 placeholder:text-greyscale-blue-500 border-0 focus:border-0 flex-1 min-w-[200px]"
              style={{outline: '1px solid #666469', outlineOffset: '-1px'}}
            />
            <button 
              onClick={handleAddParticipant} 
              className="px-4 py-2 bg-brand-primary hover:bg-purple-300 text-greyscale-blue-100 text-sm font-brockmann font-medium leading-5 rounded-[2px] flex justify-center items-center transition-colors whitespace-nowrap"
            >
              Add
            </button>
            <button 
              onClick={handleAddAIParticipant} 
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-brockmann font-medium leading-5 rounded-[2px] flex justify-center items-center gap-2 transition-colors whitespace-nowrap"
              title="Add AI Player"
              type="button"
            >
              <Bot size={16} />
              Add AI
            </button>
          </div>

          {draftMode === 'multiplayer' && (
            <div className="p-4 bg-teal-900 rounded flex items-center gap-2" style={{outline: '1px solid #B2FFEA', outlineOffset: '-1px'}}>
              <div className="flex w-6 shrink-0 justify-center items-center max-md:hidden">
                <EmailIcon className="h-6 w-6 text-teal-200" />
              </div>
              <p className="flex-1 text-teal-200 text-sm font-brockmann font-medium leading-5 m-0">
                <span className="font-bold">Multiplayer Mode:</span> Enter email addresses of friends you want to invite. They&apos;ll receive an email invitation to join.
              </p>
            </div>
          )}

          {participants.length > 0 && (
              <div className="flex flex-col gap-3">
              <p className="text-greyscale-blue-300 text-base font-normal leading-6 font-brockmann m-0">
                Participants ({participants.length}):
              </p>
              <div className="flex flex-wrap gap-2">
                {participants.map((participant) => (
                  <div
                    key={participant.name}
                    className={`py-2 pl-4 pr-[10px] bg-brand-primary rounded flex items-center gap-2 ${
                      draftMode === 'multiplayer' && !participant.isAI && !isEmailValid(participant.name)
                        ? 'bg-red-900 border border-red-500'
                        : ''
                    }`}
                  >
                    {participant.isAI ? (
                      <Bot size={16} className="text-greyscale-blue-100" />
                    ) : draftMode === 'multiplayer' && (
                      <Mail size={16} className="shrink-0 text-greyscale-blue-100 max-md:hidden" />
                    )}
                    <span className="text-greyscale-blue-100 text-sm font-brockmann font-medium leading-5">
                      {participant.name}
                    </span>
                    {participant.isAI && (
                      <span className="text-xs text-greyscale-blue-300 ml-1">AI</span>
                    )}
                    {draftMode === 'multiplayer' && !participant.isAI && !isEmailValid(participant.name) && (
                      <span className="text-xs text-red-400 ml-1">Invalid</span>
                    )}
                    <button
                      onClick={() => handleRemoveParticipant(participant)}
                      className="p-1 rounded-xl flex justify-center items-center hover:bg-purple-300 transition-colors"
                    >
                      <div className="w-4 h-4 flex justify-center items-center">
                        <TrashIcon className="w-4 h-4 text-greyscale-blue-100" />
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Categories Selection */}
      {theme !== 'people' && theme !== 'year' && isStepVisible('categories') && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleStartDraft)} className="space-y-8">
            <EnhancedCategoriesForm 
              form={form} 
              categories={categories}
              theme={theme}
              playerCount={Math.max(participants.length, draftMode === 'multiplayer' ? 2 : 1)}
              selectedOption={selectedOption}
              draftMode={draftMode}
              participants={participants}
            />

            {/* Start Draft Button */}
            <div className="text-center">
              <Button
                type="submit"
                className="bg-yellow-500 hover:bg-yellow-300 text-greyscale-blue-800 font-brockmann font-semibold px-6 py-3 text-base rounded-[2px] tracking-wide"
                size="lg"
              >
                {draftMode === 'multiplayer' ? 'Create Multiplayer Draft' : 'Start Draft'}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  </div>
  );
}
