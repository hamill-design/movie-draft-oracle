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
import { Form } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { useDraftForm, DraftSetupForm } from '@/hooks/useDraftForm';


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

  // Generate years from 1970 to 2024
  const generateYears = () => {
    const years = [];
    for (let year = 2024; year >= 1939; year--) {
      years.push(year.toString());
    }
    return years;
  };

  const years = generateYears();

  const handleAddParticipant = () => {
    addParticipant(newParticipant);
  };

  const handleRemoveParticipant = (participant: string) => {
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

    // For multiplayer, validate that all participants are valid emails
    if (draftMode === 'multiplayer') {
      const invalidEmails = participants.filter(p => !isEmailValid(p));
      if (invalidEmails.length > 0) {
        toast({
          title: "Invalid Email Addresses",
          description: `Please enter valid email addresses for: ${invalidEmails.join(', ')}`,
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
      isMultiplayer: draftMode === 'multiplayer'
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
        <title>Movie Drafter - Draft Your Favorite Movies</title>
        <meta name="description" content="Draft your favorite movies and compete with friends. Create fantasy movie drafts, pick your favorite films, and see who has the best taste in cinema." />
        <meta property="og:title" content="Movie Drafter - Draft Your Favorite Movies" />
        <meta property="og:description" content="Draft your favorite movies and compete with friends. Create fantasy movie drafts, pick your favorite films, and see who has the best taste in cinema." />
        <meta property="og:url" content="https://moviedrafter.com/" />
        <meta property="og:image" content="https://moviedrafter.com/og-image.jpg" />
        <meta name="twitter:title" content="Movie Drafter - Draft Your Favorite Movies" />
        <meta name="twitter:description" content="Draft your favorite movies and compete with friends. Create fantasy movie drafts, pick your favorite films, and see who has the best taste in cinema." />
        <meta name="twitter:image" content="https://moviedrafter.com/og-image.jpg" />
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
          {/* Join Existing Draft */}
          <JoinDraftForm />
          
          {/* Start a Special Draft */}
          <SpecDraftSelector />
          
          {/* Theme Selection */}
          <div className="w-full p-6 bg-greyscale-purp-900 rounded-[8px] flex flex-col gap-6" style={{boxShadow: '0px 0px 6px #3B0394'}}>
            <div className="self-stretch flex flex-col justify-center items-center gap-2">
              <div className="text-greyscale-blue-100 text-2xl font-bold leading-8 tracking-wide font-brockmann text-center">
                Choose Your Draft Theme
              </div>
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
                <span className="font-brockmann">Draft by Person</span>
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
                  title={theme === 'people' ? 'Search for a Person' : 'Select a Year'} 
                  icon={theme === 'people' ? 
                    <PersonIcon className="w-6 h-6 text-purple-300" /> : 
                    <CalendarIcon className="w-6 h-6 text-purple-300" />
                  } 
                />
                
                {theme === 'people' ? (
                  <>
                    <Input
                      placeholder="Search for actors, directors..."
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
                      <div className="mb-4">
                        <div className="w-full h-full flex-col justify-start items-center gap-1.5 inline-flex">
                          <span className="text-greyscale-blue-100 text-sm font-medium leading-5 font-brockmann">
                            You've Selected
                          </span>
                          <span className="text-purple-300 text-2xl font-bold leading-8 font-brockmann">
                            {selectedOption}
                          </span>
                        </div>
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
                      <div className="w-full flex flex-col justify-start items-center gap-1.5 mt-4">
                        <span className="text-greyscale-blue-300 text-sm font-brockmann font-medium leading-5">
                          You've Selected
                        </span>
                        <span className="text-purple-300 text-2xl font-brockmann font-bold leading-8 tracking-[0.96px]">
                          {selectedOption}
                        </span>
                      </div>
                    )}
                  </>
                )}
            </div>
          )}

          {/* Draft Mode Selection */}
          {isStepVisible('mode') && (
            <div className="w-full p-6 bg-greyscale-purp-900 rounded-[8px] flex flex-col gap-6" style={{boxShadow: '0px 0px 6px #3B0394'}}>
              <div className="self-stretch flex flex-col justify-center items-center gap-2">
                <div className="text-greyscale-blue-100 text-2xl font-bold leading-8 tracking-wide font-brockmann">
                  Select A Mode
                </div>
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
                  <div className="self-stretch flex flex-col">
                    <span className="text-teal-200 text-sm font-medium leading-5 font-brockmann">
                      <span className="font-bold">Multiplayer Mode:</span> Enter email addresses of friends you want to invite. They'll receive an email invitation to join your draft.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Participants */}
          {isStepVisible('participants') && (
            <div className="p-6 bg-greyscale-purp-900 rounded-[8px] flex flex-col gap-6" style={{boxShadow: '0px 0px 6px #3B0394'}}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 flex justify-center items-center">
                  <MultiPersonIcon className="w-6 h-6 text-purple-300" />
                </div>
                <span className="text-greyscale-blue-100 text-xl font-brockmann font-medium leading-7">
                  Add Participants
                </span>
              </div>
              
              <div className="flex gap-2">
                <Input
                  placeholder={draftMode === 'multiplayer' ? "Enter participant email..." : "Enter participant name..."}
                  value={newParticipant}
                  onChange={(e) => setNewParticipant(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddParticipant()}
                  className="rounded-[2px] bg-greyscale-purp-850 text-greyscale-blue-100 placeholder:text-greyscale-blue-500 border-0 focus:border-0"
                  style={{outline: '1px solid #666469', outlineOffset: '-1px'}}
                />
                <button 
                  onClick={handleAddParticipant} 
                  className="px-4 py-2 bg-brand-primary hover:bg-purple-300 text-greyscale-blue-100 text-sm font-brockmann font-medium leading-5 rounded-[2px] flex justify-center items-center transition-colors"
                >
                  Add
                </button>
              </div>

              {draftMode === 'multiplayer' && (
                <div className="p-4 bg-teal-900 rounded flex items-center gap-2" style={{outline: '1px solid #B2FFEA', outlineOffset: '-1px'}}>
                  <div className="w-6 h-6 flex justify-center items-center">
                    <EmailIcon className="w-6 h-6 text-teal-200" />
                  </div>
                  <div className="flex-1">
                    <span className="text-teal-200 text-sm font-brockmann font-medium leading-5">
                      <span className="font-bold">Multiplayer Mode:</span> Enter email addresses of friends you want to invite. They'll receive an email invitation to join.
                    </span>
                  </div>
                </div>
              )}

              {participants.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div>
                    <span className="text-greyscale-blue-300 text-base font-normal leading-6 font-brockmann">
                      Participants ({participants.length}):
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {participants.map((participant) => (
                      <div
                        key={participant}
                        className={`py-2 pl-4 pr-[10px] bg-brand-primary rounded flex items-center gap-2 ${
                          draftMode === 'multiplayer' && !isEmailValid(participant)
                            ? 'bg-red-900 border border-red-500'
                            : ''
                        }`}
                      >
                        {draftMode === 'multiplayer' && <Mail size={16} className="text-greyscale-blue-100" />}
                        <span className="text-greyscale-blue-100 text-sm font-brockmann font-medium leading-5">
                          {participant}
                        </span>
                        {draftMode === 'multiplayer' && !isEmailValid(participant) && (
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
          {isStepVisible('categories') && (
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
    </>
  );
};

export default Home;
