import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Film, Users, Search, Calendar, User, LogOut, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMovies } from '@/hooks/useMovies';

const Home = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [draftSize, setDraftSize] = useState(4);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();

  // Use the movies hook for fetching people when needed
  const { movies: searchResults, loading: searchLoading } = useMovies(
    selectedTheme === 'people' ? 'person' : undefined,
    searchTerm
  );

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const themes = [
    { 
      name: 'Year', 
      icon: Calendar, 
      description: 'Movies from specific decades or years',
      key: 'year'
    },
    { 
      name: 'People', 
      icon: User, 
      description: 'Movies featuring specific actors or directors',
      key: 'people'
    }
  ];

  // Generate year options (current year back to 1950)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1949 }, (_, i) => currentYear - i);

  const handleThemeSelect = (themeKey: string) => {
    setSelectedTheme(themeKey);
    setSearchTerm('');
    setSelectedOption(null);
  };

  const handleOptionSelect = (option: string) => {
    setSelectedOption(option);
  };

  const handleStartDraft = () => {
    if (selectedTheme && selectedOption) {
      navigate(`/draft-setup?theme=${selectedTheme}&option=${encodeURIComponent(selectedOption)}&draftSize=${draftSize}`);
    } else {
      navigate('/draft');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleBack = () => {
    setSelectedTheme(null);
    setSelectedOption(null);
    setSearchTerm('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth page
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Film className="text-yellow-400" size={40} />
              <h1 className="text-4xl font-bold text-white">Movie Draft League</h1>
              <Film className="text-yellow-400" size={40} />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-300">Welcome, {user.email}</span>
              <Button
                onClick={handleSignOut}
                variant="outline"
                size="sm"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <LogOut size={16} className="mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
          <p className="text-gray-300 text-lg">
            Create your perfect movie draft and compete with friends
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Draft Settings */}
          <Card className="bg-gray-800 border-gray-600">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="text-yellow-400" size={24} />
                Draft Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-gray-300 font-medium">Number of People:</label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDraftSize(Math.max(2, draftSize - 1))}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    -
                  </Button>
                  <span className="text-white font-bold text-lg px-4">{draftSize}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDraftSize(Math.min(8, draftSize + 1))}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    +
                  </Button>
                </div>
              </div>
              <Button 
                onClick={handleStartDraft}
                className="w-full bg-yellow-400 text-black hover:bg-yellow-500 font-semibold"
                size="lg"
              >
                Start New Draft
              </Button>
            </CardContent>
          </Card>

          {/* Theme Selection */}
          {!selectedTheme ? (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Select A Theme</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {themes.map((theme) => (
                  <Card 
                    key={theme.key} 
                    className="bg-gray-800 border-gray-600 hover:border-yellow-400 transition-colors cursor-pointer"
                    onClick={() => handleThemeSelect(theme.key)}
                  >
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <theme.icon className="text-yellow-400" size={24} />
                        {theme.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-300 text-sm">{theme.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            /* Theme Options Display */
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  <ArrowLeft size={16} className="mr-2" />
                  Back
                </Button>
                <h2 className="text-2xl font-bold text-white">
                  Select {themes.find(t => t.key === selectedTheme)?.name}
                </h2>
              </div>

              {/* Search for People */}
              {selectedTheme === 'people' && (
                <Card className="bg-gray-800 border-gray-600">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Search className="text-yellow-400" size={24} />
                      Search People
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search for actors or directors..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Options Display */}
              <Card className="bg-gray-800 border-gray-600">
                <CardHeader>
                  <CardTitle className="text-white">
                    {selectedTheme === 'year' && 'Select Year'}
                    {selectedTheme === 'people' && (searchTerm ? 'Search Results' : 'Popular People')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedTheme === 'year' ? (
                    <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 max-h-96 overflow-y-auto">
                      {years.map((year) => (
                        <Badge
                          key={year}
                          variant={selectedOption === year.toString() ? "default" : "secondary"}
                          className={`cursor-pointer text-center justify-center py-2 ${
                            selectedOption === year.toString()
                              ? 'bg-yellow-400 text-black'
                              : 'bg-gray-700 text-gray-300 hover:bg-yellow-400 hover:text-black'
                          } transition-colors`}
                          onClick={() => handleOptionSelect(year.toString())}
                        >
                          {year}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {searchLoading ? (
                        <div className="text-center text-gray-400">Loading...</div>
                      ) : searchResults && searchResults.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                          {searchResults.map((person) => (
                            <Badge
                              key={person.id}
                              variant={selectedOption === person.title ? "default" : "secondary"}
                              className={`cursor-pointer text-left justify-start py-3 px-4 ${
                                selectedOption === person.title
                                  ? 'bg-yellow-400 text-black'
                                  : 'bg-gray-700 text-gray-300 hover:bg-yellow-400 hover:text-black'
                              } transition-colors`}
                              onClick={() => handleOptionSelect(person.title)}
                            >
                              {person.title}
                            </Badge>
                          ))}
                        </div>
                      ) : searchTerm ? (
                        <div className="text-center text-gray-400">
                          No people found for "{searchTerm}"
                        </div>
                      ) : (
                        <div className="text-center text-gray-400">
                          Start typing to search for actors or directors
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Selection Confirmation */}
              {selectedOption && (
                <Card className="bg-gray-800 border-yellow-400">
                  <CardContent className="pt-6">
                    <div className="text-center space-y-4">
                      <p className="text-white">
                        You've selected: <span className="text-yellow-400 font-bold">{selectedOption}</span>
                      </p>
                      <Button 
                        onClick={handleStartDraft}
                        className="bg-yellow-400 text-black hover:bg-yellow-500 font-semibold"
                        size="lg"
                      >
                        Start Draft with {selectedOption}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
