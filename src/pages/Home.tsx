
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trash2, Users, Calendar, Film, Search, LogOut } from 'lucide-react';
import { usePeopleSearch } from '@/hooks/usePeopleSearch';
import { useAuth } from '@/contexts/AuthContext';

const Home = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [theme, setTheme] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [newParticipant, setNewParticipant] = useState('');

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Only search for people when theme is 'people'
  const { people, loading: peopleLoading } = usePeopleSearch(
    theme === 'people' ? searchQuery : ''
  );

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
    if (newParticipant.trim() && !participants.includes(newParticipant.trim())) {
      setParticipants([...participants, newParticipant.trim()]);
      setNewParticipant('');
    }
  };

  const handleRemoveParticipant = (participant: string) => {
    setParticipants(participants.filter(p => p !== participant));
  };

  const handleStartDraft = () => {
    if (!selectedOption || participants.length === 0) return;

    navigate('/draft-setup', {
      state: {
        theme,
        option: selectedOption,
        participants,
        draftSize: participants.length
      }
    });
  };

  const handleOptionSelect = (option: string | { title: string }) => {
    const optionValue = typeof option === 'string' ? option : option.title;
    setSelectedOption(optionValue);
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

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Don't render anything if not authenticated (redirect will happen)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="container mx-auto px-4 py-8">

        <div className="max-w-4xl mx-auto space-y-8">
          {/* Theme Selection */}
          <Card className="bg-gray-800 border-gray-600">
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Film className="text-yellow-400" />
                Choose Your Draft Theme
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  onClick={() => {
                    setTheme('people');
                    setSelectedOption('');
                    setSearchQuery('');
                  }}
                  variant={theme === 'people' ? 'default' : 'outline'}
                  className={`h-20 text-lg ${
                    theme === 'people'
                      ? 'bg-yellow-400 text-black hover:bg-yellow-500'
                      : 'border-gray-600 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <Users className="mr-3" size={24} />
                  Draft by Person
                </Button>
                <Button
                  onClick={() => {
                    setTheme('year');
                    setSelectedOption('');
                    setSearchQuery('');
                  }}
                  variant={theme === 'year' ? 'default' : 'outline'}
                  className={`h-20 text-lg ${
                    theme === 'year'
                      ? 'bg-yellow-400 text-black hover:bg-yellow-500'
                      : 'border-gray-600 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <Calendar className="mr-3" size={24} />
                  Draft by Year
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Option Selection */}
          {theme && (
            <Card className="bg-gray-800 border-gray-600">
              <CardContent className="pt-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Search className="text-yellow-400" />
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
                        <Badge variant="secondary" className="bg-yellow-400 text-black">
                          Selected: {selectedOption}
                        </Badge>
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
                              onClick={() => handleOptionSelect(person.name)}
                              className={`p-3 rounded cursor-pointer transition-colors ${
                                selectedOption === person.name
                                  ? 'bg-yellow-400 text-black'
                                  : 'bg-gray-700 hover:bg-gray-600 text-white'
                              }`}
                            >
                              <div className="font-medium">{person.name}</div>
                              <div className="text-sm opacity-75">
                                {person.known_for_department} • Known for: {person.known_for.slice(0, 2).map(item => item.title).join(', ')}
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

          {/* Participants */}
          <Card className="bg-gray-800 border-gray-600">
            <CardContent className="pt-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Users className="text-yellow-400" />
                Add Participants
              </h3>
              
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Enter participant name..."
                  value={newParticipant}
                  onChange={(e) => setNewParticipant(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddParticipant()}
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                />
                <Button onClick={handleAddParticipant} className="bg-yellow-400 hover:bg-yellow-500 text-black">
                  Add
                </Button>
              </div>

              {participants.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-white font-medium">Participants ({participants.length}):</h4>
                  <div className="flex flex-wrap gap-2">
                    {participants.map((participant) => (
                      <Badge
                        key={participant}
                        variant="secondary"
                        className="bg-gray-700 text-white pr-1 flex items-center gap-1"
                      >
                        {participant}
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

          {/* Start Draft Button */}
          <div className="text-center">
            <Button
              onClick={handleStartDraft}
              disabled={!selectedOption || participants.length === 0}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              size="lg"
            >
              Start Draft Setup
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
