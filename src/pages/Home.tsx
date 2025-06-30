
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Film, Users, Search, Calendar, User, Pen, Camera, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const Home = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [draftSize, setDraftSize] = useState(4);
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const categories = [
    { 
      name: 'Year', 
      icon: Calendar, 
      description: 'Movies from specific decades or years',
      examples: ['2020s', '1990s', '2010s']
    },
    { 
      name: 'Actor', 
      icon: User, 
      description: 'Movies featuring specific actors',
      examples: ['Tom Hanks', 'Meryl Streep', 'Denzel Washington']
    },
    { 
      name: 'Director', 
      icon: Camera, 
      description: 'Movies by renowned directors',
      examples: ['Christopher Nolan', 'Steven Spielberg', 'Martin Scorsese']
    },
    { 
      name: 'Writer', 
      icon: Pen, 
      description: 'Movies by acclaimed screenwriters',
      examples: ['Charlie Kaufman', 'Aaron Sorkin', 'Quentin Tarantino']
    }
  ];

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.examples.some(example => 
      example.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const handleStartDraft = () => {
    navigate('/draft');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
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

          {/* Search Bar */}
          <Card className="bg-gray-800 border-gray-600">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Search className="text-yellow-400" size={24} />
                Search Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by category, actor, director, writer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                />
              </div>
            </CardContent>
          </Card>

          {/* Categories */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Draft Categories</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredCategories.map((category) => (
                <Card key={category.name} className="bg-gray-800 border-gray-600 hover:border-yellow-400 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <category.icon className="text-yellow-400" size={24} />
                      {category.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-gray-300 text-sm">{category.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {category.examples.map((example) => (
                        <Badge 
                          key={example} 
                          variant="secondary" 
                          className="bg-gray-700 text-gray-300 hover:bg-yellow-400 hover:text-black cursor-pointer transition-colors"
                        >
                          {example}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Empty State for Search */}
          {searchTerm && filteredCategories.length === 0 && (
            <div className="text-center py-12">
              <Search className="mx-auto text-gray-600 mb-4" size={64} />
              <h3 className="text-xl text-gray-400 mb-2">No categories found</h3>
              <p className="text-gray-500">Try searching for actors, directors, writers, or years</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
