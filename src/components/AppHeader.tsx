import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { User, HelpCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Logo from './Logo';

const AppHeader = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  return (
    <>
      <header className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-3 text-yellow-400 hover:text-yellow-300 transition-colors"
            >
              <Logo size={48} />
              <span className="text-2xl font-bold hidden sm:inline">Movie Drafter</span>
            </button>

            {/* Right side buttons */}
            <div className="flex items-center gap-3">
              {/* How to Play Button */}
              <Dialog open={showHowToPlay} onOpenChange={setShowHowToPlay}>
                <DialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-gray-400 hover:text-white hover:bg-gray-800"
                  >
                    <HelpCircle size={16} className="mr-1" />
                    How to Play
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl bg-gray-800 border-gray-600 text-white">
                  <DialogHeader>
                    <DialogTitle className="text-xl text-yellow-400">How to Play Movie Draft</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 text-sm">
                    <div>
                      <h3 className="font-semibold text-white mb-2">What is Movie Draft?</h3>
                      <p className="text-gray-300">
                        Movie Draft is a competitive game where players take turns selecting movies based on a chosen theme. 
                        The goal is to build the highest-scoring collection of films!
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-white mb-2">How to Set Up:</h3>
                      <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Choose a draft theme (by Person or by Year)</li>
                        <li>Select your specific option (actor/director or year)</li>
                        <li>Add all players who will participate</li>
                        <li>Choose your scoring categories and draft style</li>
                      </ol>
                    </div>

                    <div>
                      <h3 className="font-semibold text-white mb-2">How to Draft:</h3>
                      <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Players take turns in order selecting movies</li>
                        <li>Search and pick movies that match your theme</li>
                        <li>Each player builds their roster of films</li>
                        <li>Continue until everyone has selected their movies</li>
                      </ol>
                    </div>

                    <div>
                      <h3 className="font-semibold text-white mb-2">Scoring:</h3>
                      <p className="text-gray-300">
                        Movies are scored based on the categories you selected (IMDb rating, box office, critics scores, etc.). 
                        The player with the highest total score wins!
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-white mb-2">Pro Tips:</h3>
                      <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>Consider all scoring categories when picking</li>
                        <li>Balance popular hits with hidden gems</li>
                        <li>Pay attention to what others are selecting</li>
                        <li>Have fun and discover new movies!</li>
                      </ul>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Profile/Login Button */}
              {user ? (
                <Button
                  onClick={() => navigate('/profile')}
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  <User size={16} className="mr-1" />
                  Profile
                </Button>
              ) : (
                <Button
                  onClick={() => navigate('/auth')}
                  variant="default"
                  size="sm"
                  className="bg-yellow-400 hover:bg-yellow-500 text-black font-medium"
                >
                  Login
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

export default AppHeader;