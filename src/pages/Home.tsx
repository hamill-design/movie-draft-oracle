import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ThemeButton } from '@/components/ui/theme-button';
import { Trash2, Users, Calendar, Film, Search, Mail } from 'lucide-react';
import { FilmReelIcon, PersonIcon, CalendarIcon, SearchIcon, EmailIcon, CheckboxIcon } from '@/components/icons';
import { usePeopleSearch } from '@/hooks/usePeopleSearch';
import { useAuth } from '@/contexts/AuthContext';
import { ActorPortrait } from '@/components/ActorPortrait';
import { useDraftCategories } from '@/hooks/useDraftCategories';
import CategoriesForm from '@/components/CategoriesForm';
import { JoinDraftForm } from '@/components/JoinDraftForm';
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
    <div className="min-h-screen" style={{background: 'linear-gradient(140deg, #FCFFFF 0%, #F0F1FF 50%, #FCFFFF 100%)'}}>
      <div className="container mx-auto px-4 py-8">

        <div className="max-w-4xl mx-auto space-y-8">
          {/* Join Existing Draft */}
          <JoinDraftForm />
          
          {/* Theme Selection */}
          <div className="w-full bg-card shadow-sm border border-border rounded flex flex-wrap">
            <div className="flex-1 p-6 flex flex-col items-start gap-6">
              <div className="self-stretch flex flex-col justify-center items-center gap-2">
                <div className="flex flex-col justify-center text-foreground text-2xl font-bold leading-8 tracking-wide font-brockmann">
                  Choose Your Draft Theme
                </div>
              </div>
              <div className="self-stretch flex items-start gap-4 flex-wrap">
                <ThemeButton
                  selected={theme === 'people'}
                  onClick={() => {
                    setTheme('people');
                    setSelectedOption('');
                    setSearchQuery('');
                  }}
                >
                  <PersonIcon className="w-6 h-6" />
                  <span>Draft by Person</span>
                </ThemeButton>
                <ThemeButton
                  selected={theme === 'year'}
                  onClick={() => {
                    setTheme('year');
                    setSelectedOption('');
                    setSearchQuery('');
                  }}
                >
                  <CalendarIcon className="w-6 h-6" />
                  <span>Draft by Year</span>
                </ThemeButton>
              </div>
            </div>
          </div>

          {/* Option Selection */}
          {isStepVisible('option') && (
            <Card className="bg-gray-800 border-gray-600">
              <CardContent className="pt-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <SearchIcon className="w-6 h-6 text-yellow-400" />
                  {theme === 'people' ? 'Search for a Person' : 'Select a Year'}
                </h3>
                
                {theme === 'people' ? (
                  <>
                    <Input
                      placeholder="Search for actors, directors..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 mb-4"
                    />
                    
                    {selectedOption && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2">
                          <ActorPortrait 
                            profilePath={null}
                            name={selectedOption}
                            size="md"
                          />
                          <Badge variant="secondary" className="bg-yellow-400 text-black">
                            Selected: {selectedOption}
                          </Badge>
                        </div>
                      </div>
                    )}

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
                              className={`p-3 rounded cursor-pointer transition-colors flex items-center gap-3 ${
                                selectedOption === person.name
                                  ? 'bg-yellow-400 text-black'
                                  : 'bg-gray-700 hover:bg-gray-600 text-white'
                              }`}
                            >
                              <ActorPortrait 
                                profilePath={person.profile_path}
                                name={person.name}
                                size="md"
                              />
                              <div>
                                <div className="font-medium">{person.name}</div>
                                <div className="text-sm opacity-75">
                                  {person.known_for_department} • Known for: {person.known_for.slice(0, 2).map(item => item.title).join(', ')}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {selectedOption && (
                      <div className="mb-4">
                        <Badge variant="secondary" className="bg-yellow-400 text-black">
                          Selected: {selectedOption}
                        </Badge>
                      </div>
                    )}
                    
                    <div className="max-h-60 overflow-y-auto">
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                        {years.map((year) => (
                          <Button
                            key={year}
                            onClick={() => handleYearSelect(year)}
                            variant={selectedOption === year ? 'default' : 'outline'}
                            className={`h-12 text-sm ${
                              selectedOption === year
                                ? 'bg-yellow-400 text-black hover:bg-yellow-500'
                                : 'border-gray-600 text-gray-300 hover:bg-gray-700'
                            }`}
                          >
                            {year}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Draft Mode Selection */}
          {isStepVisible('mode') && (
            <Card className="bg-gray-800 border-gray-600">
              <CardContent className="pt-6">
                <h3 className="text-xl font-bold text-white mb-4">
                  Draft Mode
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    type="button"
                    onClick={() => setDraftMode('single')}
                    variant={draftMode === 'single' ? 'default' : 'outline'}
                    className={`h-16 text-lg ${
                      draftMode === 'single'
                        ? 'bg-yellow-400 text-black hover:bg-yellow-500'
                        : 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <Users className="mr-3" size={20} />
                    Local Draft
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setDraftMode('multiplayer')}
                    variant={draftMode === 'multiplayer' ? 'default' : 'outline'}
                    className={`h-16 text-lg ${
                      draftMode === 'multiplayer'
                        ? 'bg-yellow-400 text-black hover:bg-yellow-500'
                        : 'border-gray-600 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <Users className="mr-3" size={20} />
                    Online Multiplayer
                  </Button>
                </div>
                {draftMode === 'multiplayer' && (
                  <div className="mt-4 p-4 bg-blue-900/20 border border-blue-600/30 rounded-lg">
                    <p className="text-blue-300 text-sm">
                      🌐 <strong>Multiplayer Mode:</strong> Create a collaborative draft where friends can join in real-time using an invite code. Each player takes turns picking from their own device!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Participants */}
          {isStepVisible('participants') && (
            <Card className="bg-gray-800 border-gray-600">
            <CardContent className="pt-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Users className="text-yellow-400" />
                {draftMode === 'multiplayer' ? 'Invite Participants' : 'Add Participants'}
              </h3>
              
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder={draftMode === 'multiplayer' ? "Enter participant email..." : "Enter participant name..."}
                  value={newParticipant}
                  onChange={(e) => setNewParticipant(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddParticipant()}
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                />
                <Button onClick={handleAddParticipant} className="bg-yellow-400 hover:bg-yellow-500 text-black">
                  Add
                </Button>
              </div>

              {draftMode === 'multiplayer' && (
                <div className="mb-4 p-3 bg-orange-900/20 border border-orange-600/30 rounded-lg">
                  <p className="text-orange-300 text-sm flex items-center gap-2">
                    <EmailIcon className="w-4 h-4" />
                    <strong>Multiplayer Mode:</strong> Enter email addresses of friends you want to invite. They'll receive an email invitation to join your draft.
                  </p>
                </div>
              )}

              {participants.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-white font-medium">
                    {draftMode === 'multiplayer' ? 'Email Invitations' : 'Participants'} ({participants.length}):
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {participants.map((participant) => (
                      <Badge
                        key={participant}
                        variant="secondary"
                        className={`pr-1 flex items-center gap-1 ${
                          draftMode === 'multiplayer' && !isEmailValid(participant)
                            ? 'bg-red-700 text-white border border-red-500'
                            : 'bg-gray-700 text-white'
                        }`}
                      >
                        {draftMode === 'multiplayer' && <Mail size={12} />}
                        {participant}
                        {draftMode === 'multiplayer' && !isEmailValid(participant) && (
                          <span className="text-xs text-red-300 ml-1">Invalid</span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveParticipant(participant)}
                          className="h-4 w-4 p-0 hover:bg-red-600"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
            </Card>
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
