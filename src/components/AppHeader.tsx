import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { User, HelpCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Logo from './Logo';

const AppHeader = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

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
              <Logo />
              <span className="text-2xl font-bold hidden sm:inline">Movie Drafter</span>
            </button>

            {/* Right side buttons */}
            <div className="flex items-center gap-3">
              {/* Learn More Button */}
              <Button 
                onClick={() => navigate('/learn-more')}
                variant="ghost" 
                size="sm"
                className="text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <HelpCircle size={16} className="mr-1" />
                Learn More
              </Button>

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