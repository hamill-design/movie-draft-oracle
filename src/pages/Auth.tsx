
import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
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
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              name: name.trim()
            }
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
    setName('');
    setIsResetMode(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{background: 'linear-gradient(140deg, #FCFFFF 0%, #F0F1FF 50%, #FCFFFF 100%)'}}>
      <div className="w-full max-w-md" style={{
        background: 'hsl(var(--greyscale-blue-100))',
        boxShadow: '0px 0px 3px rgba(0, 0, 0, 0.25)',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '24px', background: 'hsl(var(--greyscale-blue-100))' }}>
          <div style={{ paddingTop: '6px', marginBottom: '24px' }}>
            <div style={{ 
              textAlign: 'center',
              color: 'hsl(var(--greyscale-blue-800))',
              fontSize: '20px',
              fontFamily: 'Brockmann',
              fontWeight: '500',
              lineHeight: '28px',
              background: 'hsl(var(--greyscale-blue-100))',
              padding: '8px'
            }}>
              User Login
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isResetMode ? (
              <form onSubmit={handlePasswordReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {error && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    background: '#FEE2E2',
                    border: '1px solid #EF4444',
                    borderRadius: '4px',
                    color: '#DC2626',
                    fontSize: '14px'
                  }}>
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}
                
                 <div style={{ paddingTop: '3px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                   <div style={{ 
                     color: 'hsl(var(--greyscale-blue-800))',
                     fontSize: '14px',
                     fontFamily: 'Brockmann',
                     fontWeight: '500',
                     lineHeight: '20px'
                   }}>Email</div>
                   <div style={{
                     padding: '12px 16px',
                     background: 'hsl(var(--ui-primary))',
                     borderRadius: '2px',
                     border: '1px solid hsl(var(--greyscale-blue-400))'
                   }}>
                     <input
                       type="email"
                       placeholder="Enter Email Address"
                       value={email}
                       onChange={(e) => setEmail(e.target.value)}
                       style={{
                         width: '100%',
                         border: 'none',
                         outline: 'none',
                         background: 'transparent',
                         color: 'hsl(var(--greyscale-blue-800))',
                         fontSize: '14px',
                         fontFamily: 'Brockmann',
                         fontWeight: '500',
                         lineHeight: '20px'
                       }}
                       required
                     />
                   </div>
                 </div>

                 <button
                   type="submit"
                   disabled={loading}
                   style={{
                     padding: '12px 24px',
                     background: 'hsl(var(--brand-primary))',
                     borderRadius: '2px',
                     border: 'none',
                     color: 'hsl(var(--ui-bg))',
                     fontSize: '16px',
                     fontFamily: 'Brockmann',
                     fontWeight: '600',
                     lineHeight: '24px',
                     letterSpacing: '0.32px',
                     cursor: loading ? 'not-allowed' : 'pointer',
                     opacity: loading ? 0.7 : 1
                   }}
                 >
                   {loading ? 'Sending...' : 'Send Reset Email'}
                 </button>

                 <button
                   type="button"
                   onClick={resetForm}
                   style={{
                     padding: '6px 16px',
                     background: 'transparent',
                     border: 'none',
                     color: 'hsl(var(--brand-primary))',
                     fontSize: '16px',
                     fontFamily: 'Brockmann',
                     fontWeight: '600',
                     lineHeight: '24px',
                     letterSpacing: '0.32px',
                     cursor: 'pointer'
                   }}
                 >
                   Back to Sign In
                 </button>
              </form>
            ) : (
              <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {error && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    background: '#FEE2E2',
                    border: '1px solid #EF4444',
                    borderRadius: '4px',
                    color: '#DC2626',
                    fontSize: '14px'
                  }}>
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}
                
                 <div style={{ paddingTop: '3px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                   <div style={{ 
                     color: 'hsl(var(--greyscale-blue-800))',
                     fontSize: '14px',
                     fontFamily: 'Brockmann',
                     fontWeight: '500',
                     lineHeight: '20px'
                   }}>Email</div>
                   <div style={{
                     padding: '12px 16px',
                     background: 'hsl(var(--ui-primary))',
                     borderRadius: '2px',
                     border: '1px solid hsl(var(--greyscale-blue-400))'
                   }}>
                     <input
                       type="email"
                       placeholder="Enter Email Address"
                       value={email}
                       onChange={(e) => setEmail(e.target.value)}
                       style={{
                         width: '100%',
                         border: 'none',
                         outline: 'none',
                         background: 'transparent',
                         color: 'hsl(var(--greyscale-blue-800))',
                         fontSize: '14px',
                         fontFamily: 'Brockmann',
                         fontWeight: '500',
                         lineHeight: '20px'
                       }}
                       required
                     />
                   </div>
                 </div>

                {!isLogin && (
                   <div style={{ paddingTop: '3px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                     <div style={{ 
                       color: 'hsl(var(--greyscale-blue-800))',
                       fontSize: '14px',
                       fontFamily: 'Brockmann',
                       fontWeight: '500',
                       lineHeight: '20px'
                     }}>Name</div>
                     <div style={{
                       padding: '12px 16px',
                       background: 'hsl(var(--ui-primary))',
                       borderRadius: '2px',
                       border: '1px solid hsl(var(--greyscale-blue-400))'
                     }}>
                       <input
                         type="text"
                         placeholder="Enter Your Name"
                         value={name}
                         onChange={(e) => setName(e.target.value)}
                         style={{
                           width: '100%',
                           border: 'none',
                           outline: 'none',
                           background: 'transparent',
                           color: 'hsl(var(--greyscale-blue-800))',
                           fontSize: '14px',
                           fontFamily: 'Brockmann',
                           fontWeight: '500',
                           lineHeight: '20px'
                         }}
                         required={!isLogin}
                       />
                     </div>
                   </div>
                )}

                 <div style={{ paddingTop: '3px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                   <div style={{ 
                     color: 'hsl(var(--greyscale-blue-800))',
                     fontSize: '14px',
                     fontFamily: 'Brockmann',
                     fontWeight: '500',
                     lineHeight: '20px'
                   }}>Password</div>
                   <div style={{
                     padding: '12px 16px',
                     background: 'hsl(var(--ui-primary))',
                     borderRadius: '2px',
                     border: '1px solid hsl(var(--greyscale-blue-400))'
                   }}>
                     <input
                       type="password"
                       placeholder="Enter Password"
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       style={{
                         width: '100%',
                         border: 'none',
                         outline: 'none',
                         background: 'transparent',
                         color: 'hsl(var(--greyscale-blue-800))',
                         fontSize: '14px',
                         fontFamily: 'Brockmann',
                         fontWeight: '500',
                         lineHeight: '20px'
                       }}
                       required
                       minLength={6}
                     />
                   </div>
                 </div>

                {isLogin && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                     <button
                       type="button"
                       onClick={() => setIsResetMode(true)}
                       style={{
                         background: 'transparent',
                         border: 'none',
                         color: 'hsl(var(--greyscale-blue-500))',
                         fontSize: '16px',
                         fontFamily: 'Brockmann',
                         fontWeight: '400',
                         lineHeight: '24px',
                         cursor: 'pointer',
                         padding: '0'
                       }}
                     >
                       Forgot your password?
                     </button>
                  </div>
                )}

                 <button
                   type="submit"
                   disabled={loading}
                   style={{
                     padding: '12px 24px',
                     background: 'hsl(var(--brand-primary))',
                     borderRadius: '2px',
                     border: 'none',
                     color: 'hsl(var(--ui-bg))',
                     fontSize: '16px',
                     fontFamily: 'Brockmann',
                     fontWeight: '600',
                     lineHeight: '24px',
                     letterSpacing: '0.32px',
                     cursor: loading ? 'not-allowed' : 'pointer',
                     opacity: loading ? 0.7 : 1
                   }}
                 >
                   {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Sign Up')}
                 </button>
              </form>
            )}

            {!isResetMode && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                 <div style={{ 
                   textAlign: 'center',
                   color: 'hsl(var(--greyscale-blue-500))',
                   fontSize: '14px',
                   fontFamily: 'Brockmann',
                   fontWeight: '400',
                   lineHeight: '20px'
                 }}>
                   {isLogin ? "Don't have an account?" : "Already have an account?"}
                 </div>
                 <button
                   type="button"
                   onClick={() => {
                     setIsLogin(!isLogin);
                     setError('');
                     setEmail('');
                     setPassword('');
                     setName('');
                   }}
                   style={{
                     height: '40px',
                     padding: '6px 16px 8px 16px',
                     background: 'transparent',
                     border: 'none',
                     color: 'hsl(var(--brand-primary))',
                     fontSize: '16px',
                     fontFamily: 'Brockmann',
                     fontWeight: '600',
                     lineHeight: '24px',
                     letterSpacing: '0.32px',
                     cursor: 'pointer'
                   }}
                 >
                   {isLogin ? 'Create account' : 'Sign in instead'}
                 </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
