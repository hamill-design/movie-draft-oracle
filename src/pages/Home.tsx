import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, User, Mail } from 'lucide-react';
import { PersonIcon, CalendarIcon, EmailIcon, MultiPersonIcon, TrashIcon } from '@/components/icons';
import { usePeopleSearch } from '@/hooks/usePeopleSearch';
import { useAuth } from '@/contexts/AuthContext';
import { ActorPortrait } from '@/components/ActorPortrait';
import { useDraftCategories } from '@/hooks/useDraftCategories';
import EnhancedCategoriesForm from '@/components/EnhancedCategoriesForm';
import { JoinDraftForm } from '@/components/JoinDraftForm';
import { SpecDraftSelector } from '@/components/SpecDraftSelector';
import { HeaderIcon3 } from '@/components/HeaderIcon3';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';
import { graphJsonLd, webPageNode } from '@/components/seo/jsonLd';
import { Form } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { useDraftForm, DraftSetupForm } from '@/hooks/useDraftForm';
import { Participant } from '@/types/participant';
import { getRandomAIName } from '@/data/aiNames';
import { Bot } from 'lucide-react';


const Home = () => {
  const navigate = useNavigate();
  const { loading } = useAuth();
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
    defaultValues: {
      participants: [],
      categories: []
    }
  });

  // No auth redirect needed - guests can use the app

  // Only search for people when theme is 'people'
  const { people, loading: peopleLoading } = usePeopleSearch(
    theme === 'people' ? searchQuery : ''
  );

  const categories = useDraftCategories(theme || null);

  // Generate year options (newest first) through 1939
  const generateYears = () => {
    const years = [];
    for (let year = 2025; year >= 1939; year--) {
      years.push(year.toString());
    }
    return years;
  };

  const years = generateYears();

  const handleAddParticipant = () => {
    addParticipant(newParticipant);
  };

  const handleAddAIParticipant = () => {
    const aiName = getRandomAIName();
    addAIParticipant(aiName);
  };

  const handleRemoveParticipant = (participant: string | Participant) => {
    removeParticipant(participant);
  };

  const handleStartDraft = (data: DraftSetupForm) => {
    if (!selectedOption || !data.categories.length) return;

    // For local drafts, require at least 2 participants
    if (draftMode === 'single') {
      if (participants.length < 2) {
        toast({
          title: "Not Enough Participants",
          description: "Please add at least 2 participants to create a local draft.",
          variant: "destructive",
        });
        return;
      }
    }

    // For multiplayer, validate that all human participants are valid emails (skip AI participants)
    if (draftMode === 'multiplayer') {
      const humanParticipants = participants.filter(p => !p.isAI);
      const invalidEmails = humanParticipants.filter(p => !isEmailValid(p.name));
      if (invalidEmails.length > 0) {
        toast({
          title: "Invalid Email Addresses",
          description: `Please enter valid email addresses for: ${invalidEmails.map(p => p.name).join(', ')}`,
          variant: "destructive",
        });
        return;
      }
    }

    const draftData = {
      theme,
      option: selectedOption,
      participants: participants,
      categories: data.categories,
      isMultiplayer: draftMode === 'multiplayer',
      ...(draftMode === 'single' ? { forceNewDraft: true } : {}),
    };

    navigate('/draft', {
      state: draftData
    });
  };

  const handleOptionSelect = (option: string | { title: string; profile_path?: string }) => {
    if (typeof option === 'string') {
      setSelectedOption(option);
    } else {
      // For people, store only the name (not the profile path)
      setSelectedOption(option.title);
    }
    setSearchQuery('');
  };

  const handleYearSelect = (year: string) => {
    setSelectedOption(year);
  };

  const shouldShowResults = theme === 'people' && searchQuery.trim().length > 0;

  // Show loading state while initializing
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
        <div style={{color: 'var(--Text-Primary, #FCFFFF)', fontSize: '20px'}}>Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Movie Drafter – The Movie Draft Game for Friends</title>
        <meta name="description" content="Movie Drafter is the free movie draft game where you and your friends pick films, compete on taste, and settle who knows cinema best. Start a draft in minutes." />
        <link rel="canonical" href="https://moviedrafter.com/" />
        <meta property="og:title" content="Movie Drafter – The Movie Draft Game for Friends" />
        <meta property="og:description" content="Movie Drafter is the free movie draft game where you and your friends pick films, compete on taste, and settle who knows cinema best. Start a draft in minutes." />
        <meta property="og:url" content="https://moviedrafter.com/" />
        {socialShareImageMetaNodes()}
        <meta name="twitter:title" content="Movie Drafter – The Movie Draft Game for Friends" />
        <meta name="twitter:description" content="Movie Drafter is the free movie draft game where you and your friends pick films, compete on taste, and settle who knows cinema best. Start a draft in minutes." />
        <script type="application/ld+json">
          {JSON.stringify(
            graphJsonLd(
              webPageNode({
                path: '/',
                name: 'Movie Drafter – The Movie Draft Game for Friends',
                description:
                  'Movie Drafter is the free movie draft game where you and your friends pick films, compete on taste, and settle who knows cinema best. Start a draft in minutes.',
              })
            )
          )}
        </script>
      </Helmet>
      <div className="relative min-h-screen overflow-x-hidden">
        {/* Background Image - Absolutely Positioned to sit behind content */}
        <div
          style={{
            position: 'absolute',
            top: '-33px',
            left: '0',
            width: '100vw',
            height: '488px',
            backgroundImage: 'url(/bg-2014.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'top center',
            backgroundRepeat: 'no-repeat',
            zIndex: 0,
            opacity: 0.8 
          }}
        />

        {/* Hero Section */}
        <section 
          className="w-full px-6 py-16 md:py-20 relative z-10"
        >
          {/* Main Content */}
          <div 
            className="relative z-10 w-full max-w-[1400px] mx-auto px-6 flex flex-col items-center gap-6"
          >
            {/* Heading */}
            <div className="w-full flex flex-col items-center">
              <h1 
                className="w-full text-center text-6xl md:text-7xl lg:text-[90px] leading-[70px] md:leading-normal lg:leading-[90px] font-chaney font-normal text-greyscale-blue-100"
                style={{ wordWrap: 'break-word' }}
              >
                Your Picks.<br /> Your glory.
              </h1>
            </div>

            {/* Description */}
            <div className="w-full max-w-[768px] pt-2 flex flex-col items-center">
              <p 
                className="w-full max-w-[724px] text-center text-sm md:text-lg font-brockmann font-medium leading-[20px] md:leading-[26px] text-greyscale-blue-100"
                style={{ wordWrap: 'break-word' }}
              >
                Turn your film obsession into friendly competition. Draft movies, rack up points, and settle once and for all who has the best taste in cinema.
              </p>
            </div>
          </div>
        </section>

        <div className="container mx-auto px-4 pt-0 pb-8 relative z-10">

        <div className="max-w-4xl mx-auto space-y-8">
          {/* Join Existing Draft + Start a Special Draft */}
          {/* Grid: equal row heights; minmax(0,1fr) avoids overflow in narrow columns */}
          <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-stretch">
            <JoinDraftForm className="min-h-0 h-full min-w-0" />
            <SpecDraftSelector className="min-h-0 h-full min-w-0" />
          </div>
          
          {/* Theme Selection */}
          <div className="w-full p-6 bg-greyscale-purp-900 rounded-[8px] flex flex-col gap-6" style={{boxShadow: '0px 0px 6px #3B0394'}}>
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
                          onClick={() => navigate(`/draft/people/${encodeURIComponent(selectedOption)}/setup`)}
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
                          onClick={() => navigate(`/draft/year/${selectedOption}/setup`)}
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
      </div>

      {/* SEO content section — keyword-rich, crawlable text for Google */}
      <section
        aria-label="About Movie Drafter"
        className="w-full px-6 py-16"
        style={{ background: '#0E0E0F' }}
      >
        <div className="max-w-4xl mx-auto flex flex-col gap-12">
          <div className="flex flex-col gap-4">
            <h2 className="m-0 font-brockmann font-bold text-2xl text-greyscale-blue-50">
              The movie draft game for film lovers
            </h2>
            <p className="m-0 font-brockmann text-base leading-relaxed text-greyscale-blue-300">
              Movie Drafter is a free online movie draft game that lets you and your friends compete over
              cinema taste. Think of it like the NFL Draft — but instead of picking athletes, you're
              drafting films. Each player takes turns claiming movies into category slots, and whoever
              builds the highest-scoring roster wins. No trivia required: it's all about strategy and taste.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col gap-3">
              <h3 className="m-0 font-brockmann font-semibold text-lg text-purple-300">
                Draft by Filmography
              </h3>
              <p className="m-0 font-brockmann text-sm leading-relaxed text-greyscale-blue-300">
                Pick a director, actor, or writer and draft from their entire body of work. Compete to
                claim the best films in their catalog before your friends do. Great for auteur-focused
                film fans who love Spielberg, Nolan, Scorsese, or any other filmmaker's complete filmography.
              </p>
              <a
                href="/draft-by-filmography"
                className="text-sm font-brockmann font-medium text-yellow-400 underline hover:text-yellow-300"
              >
                Learn about filmography drafts →
              </a>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="m-0 font-brockmann font-semibold text-lg text-purple-300">
                Draft by Year
              </h3>
              <p className="m-0 font-brockmann text-sm leading-relaxed text-greyscale-blue-300">
                Choose a release year and draft from every film that came out that year. Draft the best
                movies of 1994, 2007, or any year in cinema history. A brilliant format for groups who
                love debating the strongest year in film.
              </p>
              <a
                href="/draft-by-year"
                className="text-sm font-brockmann font-medium text-yellow-400 underline hover:text-yellow-300"
              >
                Learn about year drafts →
              </a>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="m-0 font-brockmann font-semibold text-lg text-purple-300">
                Special Drafts
              </h3>
              <p className="m-0 font-brockmann text-sm leading-relaxed text-greyscale-blue-300">
                Browse curated themed draft pools — 80s action movies, A24 films, Oscar winners, rom-coms,
                and more. Each special draft has a hand-picked list of eligible films so everyone is
                competing on the same level playing field.
              </p>
              <a
                href="/special-draft"
                className="text-sm font-brockmann font-medium text-yellow-400 underline hover:text-yellow-300"
              >
                Browse special drafts →
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="m-0 font-brockmann font-bold text-2xl text-greyscale-blue-50">
              How the movie draft game works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <p className="m-0 font-brockmann font-semibold text-base text-greyscale-blue-100">
                  1. Choose your draft format
                </p>
                <p className="m-0 font-brockmann text-sm leading-relaxed text-greyscale-blue-300">
                  Pick from Draft by Filmography (an actor or director's catalog), Draft by Year (all films from
                  a specific year), or a Special Draft with a curated theme like 90s thrillers or Best Picture winners.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <p className="m-0 font-brockmann font-semibold text-base text-greyscale-blue-100">
                  2. Add your friends
                </p>
                <p className="m-0 font-brockmann text-sm leading-relaxed text-greyscale-blue-300">
                  Play locally with everyone on one device, or invite friends via email to an online multiplayer
                  draft. Each player gets their own picks sent to their inbox.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <p className="m-0 font-brockmann font-semibold text-base text-greyscale-blue-100">
                  3. Draft your roster
                </p>
                <p className="m-0 font-brockmann text-sm leading-relaxed text-greyscale-blue-300">
                  Take turns selecting movies into category slots like "Best Reviewed," "Biggest Box Office," or
                  "Most Oscar Nominations." Strategy counts — the movie you want might get snatched before your pick.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <p className="m-0 font-brockmann font-semibold text-base text-greyscale-blue-100">
                  4. See who wins
                </p>
                <p className="m-0 font-brockmann text-sm leading-relaxed text-greyscale-blue-300">
                  Movie Drafter automatically scores each roster using real data — box office, critic scores,
                  IMDb ratings, and award wins. The player with the best film slate wins bragging rights.
                </p>
              </div>
            </div>
            <a
              href="/how-to-draft"
              className="text-sm font-brockmann font-medium text-yellow-400 underline hover:text-yellow-300 w-fit"
            >
              Read the complete how-to-draft guide →
            </a>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="m-0 font-brockmann font-bold text-2xl text-greyscale-blue-50">
              Why play Movie Drafter?
            </h2>
            <p className="m-0 font-brockmann text-base leading-relaxed text-greyscale-blue-300">
              Movie Drafter is the only free movie drafting game built specifically for film enthusiasts.
              Unlike movie trivia games, there are no right or wrong answers — just competing taste and strategy.
              It's the perfect movie game for friends on a group chat, film club nights, or any gathering where
              everyone has opinions about cinema. Draft movies with friends online in minutes, or play in-person
              with everyone on the same screen.
            </p>
            <p className="m-0 font-brockmann text-base leading-relaxed text-greyscale-blue-300">
              With hundreds of filmographies, every year in cinema history, and growing library of curated special
              drafts, there's always a new movie picking competition waiting. Start your first fantasy movie draft
              today — no account required.
            </p>
            <a
              href="/faq"
              className="text-sm font-brockmann font-medium text-yellow-400 underline hover:text-yellow-300 w-fit"
            >
              Frequently asked questions →
            </a>
          </div>
        </div>
      </section>
    </>
  );
};

export default Home;
