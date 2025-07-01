
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trash2, Users, Calendar, Film, Search } from 'lucide-react';
import { useMovies } from '@/hooks/useMovies';

const Home = () => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [newParticipant, setNewParticipant] = useState('');

  // Determine search category based on theme
  const getSearchCategory = () => {
    if (theme === 'people') return 'person_search';
    if (theme === 'year') return 'search';
    return '';
  };

  const { movies, loading } = useMovies(getSearchCategory(), searchQuery);

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
        participants
      }
    });
  };

  const handleOptionSelect = (option: string | { title: string }) => {
    const optionValue = typeof option === 'string' ? option : option.title;
    setSelectedOption(optionValue);
    setSearchQuery('');
  };

  const shouldShowResults = searchQuery.trim().length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            🎬 Movie Draft Generator
          </h1>
          <p className="text-xl text-gray-300">
            Create epic movie drafts with your friends
          </p>
        </div>

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
                  {theme === 'people' ? 'Search for a Person' : 'Search for Movies by Year'}
                </h3>
                <Input
                  placeholder={
                    theme === 'people'
                      ? 'Search for actors, directors...'
                      : 'Enter a year (e.g., 2020)...'
                  }
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
                    {loading ? (
                      <div className="text-gray-400">Searching...</div>
                    ) : movies.length === 0 ? (
                      <div className="text-gray-400">
                        No {theme === 'people' ? 'people' : 'results'} found
                      </div>
                    ) : (
                      movies.slice(0, 10).map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleOptionSelect(item.title)}
                          className={`p-3 rounded cursor-pointer transition-colors ${
                            selectedOption === item.title
                              ? 'bg-yellow-400 text-black'
                              : 'bg-gray-700 hover:bg-gray-600 text-white'
                          }`}
                        >
                          <div className="font-medium">{item.title}</div>
                          {theme === 'people' && (
                            <div className="text-sm opacity-75">
                              {item.genre} • {item.description}
                            </div>
                          )}
                          {theme === 'year' && (
                            <div className="text-sm opacity-75">
                              {item.year} • {item.genre}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
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
