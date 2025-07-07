
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Film, Mail, Lock, User, AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        navigate('/');
      }
    };
    
    checkAuth();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setError('Invalid email or password. Please check your credentials.');
          } else {
            setError(error.message);
          }
        } else {
          toast({
            title: "Welcome back!",
            description: "You've been successfully logged in.",
          });
          navigate('/');
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`
          }
        });
        
        if (error) {
          if (error.message.includes('User already registered')) {
            setError('An account with this email already exists. Please sign in instead.');
          } else {
            setError(error.message);
          }
        } else {
          toast({
            title: "Account created!",
            description: "Please check your email to confirm your account.",
          });
          setIsLogin(true);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setError(error.message);
      } else {
        toast({
          title: "Reset email sent!",
          description: "Please check your email for password reset instructions.",
        });
        setIsResetMode(false);
        setIsLogin(true);
        setEmail('');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setError('');
    setEmail('');
    setPassword('');
    setIsResetMode(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center px-4">
      <Card className="w-full max-w-md bg-gray-800 border-gray-600">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Film className="text-yellow-400" size={32} />
            <CardTitle className="text-2xl text-white">Movie Draft League</CardTitle>
          </div>
          <p className="text-gray-300">
            {isResetMode ? 'Reset your password' : (isLogin ? 'Welcome back!' : 'Create your account')}
          </p>
        </CardHeader>
        <CardContent>
          {isResetMode ? (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-900/50 border border-red-600 rounded text-red-200 text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-gray-300 text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-yellow-400 text-black hover:bg-yellow-500 font-semibold"
              >
                {loading ? 'Sending...' : 'Send Reset Email'}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={resetForm}
                className="w-full text-yellow-400 hover:text-yellow-300 hover:bg-transparent"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Sign In
              </Button>
            </form>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-900/50 border border-red-600 rounded text-red-200 text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-gray-300 text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-gray-300 text-sm font-medium">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {isLogin && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsResetMode(true)}
                    className="text-sm text-yellow-400 hover:text-yellow-300 hover:bg-transparent p-0 h-auto"
                  >
                    Forgot your password?
                  </Button>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-yellow-400 text-black hover:bg-yellow-500 font-semibold"
              >
                {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Sign Up')}
              </Button>
            </form>
          )}

          {!isResetMode && (
            <div className="mt-6 text-center">
              <p className="text-gray-400 text-sm">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
              </p>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setEmail('');
                  setPassword('');
                }}
                className="text-yellow-400 hover:text-yellow-300 hover:bg-transparent"
              >
                {isLogin ? 'Create account' : 'Sign in instead'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
