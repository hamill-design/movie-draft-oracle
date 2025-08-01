
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/atoms';
import { HelpCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import LogoLong from '@/assets/logos/Property 1=Long, _hover=false.svg';
import LogoDefault from '@/assets/logos/Property 1=Default, _hover=false.svg';

const AppHeader = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <>
      <header className="bg-greyscale-blue-900 p-5 sticky top-0 z-50">
        {/* Desktop Layout (lg+) */}
        <div className="hidden lg:flex w-full items-center justify-between">
          {/* Brand/Logo Section */}
          <button
            onClick={() => navigate('/')}
            className="flex items-start gap-2.5 w-full max-w-[647px]"
          >
            <img src={LogoLong} alt="Movie Draft" className="flex-1 h-10" />
          </button>

          {/* Right side buttons */}
          <div className="flex items-center gap-3">
            {/* Learn More Button */}
            <Button 
              onClick={() => navigate('/learn-more')}
              variant="ghost" 
              size="sm"
              font="brockmann-medium"
              className="text-purple-200 hover:text-purple-200/80 hover:bg-transparent px-3 py-2 text-sm"
            >
              <HelpCircle size={16} className="mr-2" />
              Learn More
            </Button>

            {/* Profile/Login Button */}
            {user ? (
              <Button
                onClick={() => navigate('/profile')}
                variant="default"
                size="sm"
                font="brockmann-medium"
                className="bg-brand-primary hover:bg-brand-primary/90 text-white px-4 py-2 text-sm rounded-sm"
              >
                My Profile
              </Button>
            ) : (
              <Button
                onClick={() => navigate('/auth')}
                variant="default"
                size="sm"
                font="brockmann-medium"
                className="bg-brand-primary hover:bg-brand-primary/90 text-white px-4 py-2 text-sm rounded-sm"
              >
                Login
              </Button>
            )}
          </div>
        </div>

        {/* Tablet Layout (md-lg) */}
        <div className="hidden md:flex lg:hidden w-full items-center justify-between">
          {/* Brand/Logo Section */}
          <button
            onClick={() => navigate('/')}
            className="overflow-hidden"
          >
            <img src={LogoDefault} alt="Movie Draft" className="w-[288.25px] h-auto" />
          </button>

          {/* Right side buttons */}
          <div className="flex flex-col items-end gap-3">
            {/* Profile/Login Button */}
            {user ? (
              <Button
                onClick={() => navigate('/profile')}
                variant="default"
                size="sm"
                font="brockmann-medium"
                className="bg-brand-primary hover:bg-brand-primary/90 text-white px-4 py-2 text-sm rounded-sm"
              >
                My Profile
              </Button>
            ) : (
              <Button
                onClick={() => navigate('/auth')}
                variant="default"
                size="sm"
                font="brockmann-medium"
                className="bg-brand-primary hover:bg-brand-primary/90 text-white px-4 py-2 text-sm rounded-sm"
              >
                Login
              </Button>
            )}

            {/* Learn More Button */}
            <Button 
              onClick={() => navigate('/learn-more')}
              variant="ghost" 
              size="sm"
              font="brockmann-medium"
              className="text-purple-200 hover:text-purple-200/80 hover:bg-transparent px-3 py-2 text-sm"
            >
              <HelpCircle size={16} className="mr-2" />
              Learn More
            </Button>
          </div>
        </div>

        {/* Mobile Layout (sm) */}
        <div className="flex md:hidden w-full flex-col gap-6">
          {/* Brand/Logo Section */}
          <button
            onClick={() => navigate('/')}
            className="self-stretch"
          >
            <img src={LogoLong} alt="Movie Draft" className="w-full h-[21.65px]" />
          </button>

          {/* Right side buttons */}
          <div className="self-stretch flex justify-end items-start gap-3">
            {/* Learn More Button */}
            <Button 
              onClick={() => navigate('/learn-more')}
              variant="ghost" 
              size="sm"
              font="brockmann-medium"
              className="text-purple-200 hover:text-purple-200/80 hover:bg-transparent px-3 py-2 text-sm"
            >
              <HelpCircle size={16} className="mr-2" />
              Learn More
            </Button>

            {/* Profile/Login Button */}
            {user ? (
              <Button
                onClick={() => navigate('/profile')}
                variant="default"
                size="sm"
                font="brockmann-medium"
                className="bg-brand-primary hover:bg-brand-primary/90 text-white px-4 py-2 text-sm rounded-sm"
              >
                My Profile
              </Button>
            ) : (
              <Button
                onClick={() => navigate('/auth')}
                variant="default"
                size="sm"
                font="brockmann-medium"
                className="bg-brand-primary hover:bg-brand-primary/90 text-white px-4 py-2 text-sm rounded-sm"
              >
                Login
              </Button>
            )}
          </div>
        </div>
      </header>
    </>
  );
};

export default AppHeader;
