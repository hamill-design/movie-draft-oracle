import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ThemeButton } from '@/components/ui/theme-button';
import { Trash2, Users, User, Calendar, Film, Search, Mail } from 'lucide-react';
import { FilmReelIcon, PersonIcon, CalendarIcon, SearchIcon, EmailIcon, CheckboxIcon, MultiPersonIcon, TrashIcon } from '@/components/icons';
import { usePeopleSearch } from '@/hooks/usePeopleSearch';
import { useAuth } from '@/contexts/AuthContext';
import { ActorPortrait } from '@/components/ActorPortrait';
import { useDraftCategories } from '@/hooks/useDraftCategories';
import CategoriesForm from '@/components/CategoriesForm';
import { JoinDraftForm } from '@/components/JoinDraftForm';
import { HeaderIcon3 } from '@/components/HeaderIcon3';
import { Form } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { useDraftForm, DraftSetupForm } from '@/hooks/useDraftForm';


const Home = () => {
  const navigate = useNavigate();
  const { user, loading, signOut, isGuest } = useAuth();
  const { toast } = useToast();
  
  const {
    state: { theme, searchQuery, selectedOption, participants, newParticipant, draftMode },
    getCurrentStep,
    isStepComplete,
    isStepVisible,
    setTheme,
    setSelectedOption,
    setDraftMode,
    setSearchQuery,
    setNewParticipant,
    addParticipant,
    removeParticipant,
    isEmailValid,
    validateStep,
    canStartDraft,
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

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const shouldShowResults = theme === 'people' && searchQuery.trim().length > 0;

  // Show loading state while initializing
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ui-bg">
      <div className="container mx-auto px-4 py-8">

        <div className="max-w-4xl mx-auto space-y-8">
          {/* Join Existing Draft */}
          <JoinDraftForm />
          
          {/* Theme Selection */}
          <div className="w-full p-6 bg-greyscale-blue-100 rounded flex flex-col gap-6" style={{boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.25)'}}>
            <div className="self-stretch flex flex-col justify-center items-center gap-2">
              <div className="text-foreground text-2xl font-bold leading-8 tracking-wide font-brockmann">
                Choose Your Draft Theme
              </div>
            </div>
            <div className="self-stretch flex items-start gap-4 flex-wrap">
              <button
                onClick={() => {
                  setTheme('people');
                  setSelectedOption('');
                  setSearchQuery('');
                }}
                className={`flex-1 h-20 min-w-[294px] px-9 py-2 rounded-[6px] border flex justify-center items-center gap-4 text-lg font-medium transition-colors ${
                  theme === 'people'
                    ? 'bg-purple-500 border-purple-500 text-white'
                    : 'bg-ui-primary border-greyscale-blue-200 text-text-primary hover:bg-purple-100 hover:border-purple-200 active:bg-purple-200 active:border-purple-300'
                }`}
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
                className={`flex-1 h-20 min-w-[294px] px-9 py-2 rounded-[6px] border flex justify-center items-center gap-4 text-lg font-medium transition-colors ${
                  theme === 'year'
                    ? 'bg-purple-500 border-purple-500 text-white'
                    : 'bg-ui-primary border-greyscale-blue-200 text-text-primary hover:bg-purple-100 hover:border-purple-200 active:bg-purple-200 active:border-purple-300'
                }`}
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
            <div className="p-6 bg-greyscale-blue-100 rounded space-y-4" style={{boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.25)'}}>
                <HeaderIcon3 
                  title={theme === 'people' ? 'Search for a Person' : 'Select a Year'} 
                  icon={theme === 'people' ? 
                    <PersonIcon className="w-6 h-6 text-primary" /> : 
                    <CalendarIcon className="w-6 h-6 text-primary" />
                  } 
                />
                
                {theme === 'people' ? (
                  <>
                    <Input
                      placeholder="Search for actors, directors..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="mb-4 rounded-[2px]"
                    />
                    
                    
                    {shouldShowResults && (
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {peopleLoading ? (
                          <div className="text-gray-400">Searching...</div>
                        ) : people.length === 0 ? (
                          <div className="text-gray-400">No people found</div>
                        ) : (
                          people.slice(0, 10).map((person) => (
                            <div
                              key={person.id}
                              onClick={() => handleOptionSelect({ title: person.name, profile_path: person.profile_path })}
                              className={`w-full py-4 px-4 pr-6 bg-white rounded border border-[#D9E0DF] cursor-pointer transition-colors flex items-start gap-4 ${
                                selectedOption === person.name
                                  ? 'bg-yellow-400 text-black'
                                  : 'hover:bg-[#F8F7FF] hover:border-[#EDEBFF] active:bg-[#EDEBFF] active:border-[#BCB2FF]'
                              }`}
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
                                  <span className="text-text-primary text-base font-semibold leading-6 tracking-[0.32px] font-brockmann">
                                    {person.name}
                                  </span>
                                </div>
                                <div className="self-stretch flex flex-col justify-start items-start">
                                  <span className="text-[#828786] text-sm font-normal leading-5 font-brockmann">
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
                          <span className="text-muted-foreground text-sm font-medium leading-5 font-brockmann">
                            You've Selected
                          </span>
                          <span className="text-primary text-lg font-semibold leading-6 font-brockmann">
                            {selectedOption}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    
                    <div className="max-h-60 overflow-y-auto">
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                        {years.map((year) => (
                          <Button
                            key={year}
                            onClick={() => handleYearSelect(year)}
                            variant={selectedOption === year ? 'default' : 'outline'}
                            className={`h-12 text-sm font-brockmann-medium transition-colors ${
                              selectedOption === year
                                ? 'bg-purple-500 text-white hover:bg-purple-500 border-0'
                                : 'bg-ui-primary text-text-primary border-0 hover:bg-purple-100 active:bg-greyscale-blue-150'
                            }`}
                            style={{
                              borderRadius: '6px',
                              outline: selectedOption === year ? '1px solid hsl(var(--purple-500))' : '0.5px solid hsl(var(--text-primary))',
                              outlineOffset: '-1px'
                            }}
                          >
                            {year}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {selectedOption && (
                      <div className="w-full flex flex-col justify-start items-center gap-1.5 mt-4">
                        <span className="text-greyscale-blue-600 text-sm font-brockmann-medium leading-5">
                          You've Selected
                        </span>
                        <span className="text-brand-primary text-lg font-brockmann font-semibold leading-6">
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
            <div className="w-full p-6 bg-greyscale-blue-100 rounded flex flex-col gap-6" style={{boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.25)'}}>
              <div className="self-stretch flex flex-col justify-center items-center gap-2">
                <div className="text-foreground text-2xl font-bold leading-8 tracking-wide font-brockmann">
                  Select A Mode
                </div>
              </div>
              <div className="self-stretch flex items-start gap-4 flex-wrap">
                <button
                  type="button"
                  onClick={() => setDraftMode('single')}
                  className={`flex-1 h-20 min-w-[294px] px-9 py-2 rounded-[6px] border flex justify-center items-center gap-4 text-lg font-medium transition-colors ${
                    draftMode === 'single'
                      ? 'bg-purple-500 border-purple-500 text-white'
                      : 'bg-ui-primary border-greyscale-blue-200 text-text-primary hover:bg-purple-100 hover:border-purple-100 active:bg-purple-200 active:border-purple-300'
                  }`}
                >
                  <div className="w-6 h-6 flex justify-center items-center">
                    <User className="w-6 h-6" />
                  </div>
                  <span className="font-brockmann">Local Draft</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDraftMode('multiplayer')}
                  className={`flex-1 h-20 min-w-[294px] px-9 py-2 rounded-[6px] border flex justify-center items-center gap-4 text-lg font-medium transition-colors ${
                    draftMode === 'multiplayer'
                      ? 'bg-purple-500 border-purple-500 text-white'
                      : 'bg-ui-primary border-greyscale-blue-200 text-text-primary hover:bg-purple-100 hover:border-purple-100 active:bg-purple-200 active:border-purple-300'
                  }`}
                >
                  <div className="w-6 h-6 flex justify-center items-center">
                    <Users className="w-6 h-6" />
                  </div>
                  <span className="font-brockmann">Online Multiplayer</span>
                </button>
              </div>
              {draftMode === 'multiplayer' && (
                <div className="self-stretch p-4 bg-teal-100 rounded border border-teal-700 flex flex-col">
                  <div className="self-stretch flex flex-col">
                    <span className="text-teal-700 text-sm font-bold leading-5 font-brockmann">
                      Multiplayer Mode:
                    </span>
                    <span className="text-teal-700 text-sm font-medium leading-5 font-brockmann">
                      {" "}Enter email addresses of friends you want to invite. They'll receive an email invitation to join your draft.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Participants */}
          {isStepVisible('participants') && (
            <div className="p-6 bg-greyscale-blue-100 rounded flex flex-col gap-6" style={{boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.25)'}}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 flex justify-center items-center">
                  <MultiPersonIcon className="w-6 h-6 text-primary" />
                </div>
                <span className="text-text-primary text-xl font-brockmann font-medium leading-7">
                  Add Participants
                </span>
              </div>
              
              <div className="flex gap-2">
                <Input
                  placeholder={draftMode === 'multiplayer' ? "Enter participant email..." : "Enter participant name..."}
                  value={newParticipant}
                  onChange={(e) => setNewParticipant(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddParticipant()}
                  className="rounded-[2px]"
                />
                <button 
                  onClick={handleAddParticipant} 
                  className="px-4 py-2 bg-purple-500 text-white text-sm font-brockmann font-medium leading-5 rounded-[2px] flex justify-center items-center"
                >
                  Add
                </button>
              </div>

              {draftMode === 'multiplayer' && (
                <div className="p-4 bg-teal-100 border border-teal-700 rounded flex items-center gap-2">
                  <div className="w-6 h-6 flex justify-center items-center">
                    <EmailIcon className="w-6 h-6 text-teal-700" />
                  </div>
                  <div className="flex-1">
                    <span className="text-teal-700 text-sm font-brockmann font-bold leading-5">
                      Multiplayer Mode:
                    </span>
                    <span className="text-teal-700 text-sm font-brockmann font-medium leading-5">
                      {" "}Enter email addresses of friends you want to invite. They'll receive an email invitation to join.
                    </span>
                  </div>
                </div>
              )}

              {participants.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div>
                    <span className="text-greyscale-blue-600 text-base font-brockmann leading-6">
                      Participants ({participants.length}):
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {participants.map((participant) => (
                      <div
                        key={participant}
                        className={`py-2 px-4 pr-2.5 bg-purple-150 rounded flex items-center gap-2 ${
                          draftMode === 'multiplayer' && !isEmailValid(participant)
                            ? 'bg-red-200 border border-red-500'
                            : ''
                        }`}
                      >
                        {draftMode === 'multiplayer' && <Mail size={16} className="text-primary" />}
                        <span className="text-text-primary text-sm font-brockmann font-medium leading-5">
                          {participant}
                        </span>
                        {draftMode === 'multiplayer' && !isEmailValid(participant) && (
                          <span className="text-xs text-red-600 ml-1">Invalid</span>
                        )}
                        <button
                          onClick={() => handleRemoveParticipant(participant)}
                          className="p-1 rounded-xl hover:bg-purple-100 transition-colors flex justify-center items-center"
                        >
                          <div className="w-4 h-4 flex justify-center items-center">
                            <TrashIcon className="w-4 h-4 text-foreground" />
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
                <CategoriesForm form={form} categories={categories} />

                {/* Start Draft Button */}
                <div className="text-center">
                  <Button
                    type="submit"
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-4 text-lg"
                    size="lg"
                  >
                    {draftMode === 'multiplayer' ? 'Create Multiplayer Draft' : 'Start Solo Draft'}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
