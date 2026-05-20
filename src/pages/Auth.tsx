import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';
import { AlertCircle, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { getPendingDraft, clearPendingDraft } from '@/utils/draftStorage';
import { savePendingAvatar, validateAvatarFile, fileToPreviewDataUrl, getInitials } from '@/utils/avatarUpload';

/** Origin for Supabase auth email links (signup confirm, password reset). Override with VITE_APP_URL for local testing. */
const PUBLIC_SITE_URL = (import.meta.env.VITE_APP_URL || 'https://moviedrafter.com').replace(
  /\/+$/,
  ''
);

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [marketingEmailsOptIn, setMarketingEmailsOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isButtonHovered, setIsButtonHovered] = useState(false);
  const [isGoogleButtonHovered, setIsGoogleButtonHovered] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isTextButtonHovered, setIsTextButtonHovered] = useState(false);
  const [isForgotPasswordHovered, setIsForgotPasswordHovered] = useState(false);
  const [isSignupStep2, setIsSignupStep2] = useState(false);
  const [signupName, setSignupName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
          
          // Wait for session to be available before trying to save draft
          // The auth state change happens asynchronously, so we need to wait
          let attempts = 0;
          const maxAttempts = 15;
          while (attempts < maxAttempts) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              // Session is available, now we can save the draft
              // We use session.user.id directly, so we don't need to wait for React state
              await handlePostLoginDraftSave();
              break;
            }
            // Wait a bit before checking again
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
          }
          
          // Get return path from URL params or default to home
          const returnTo = searchParams.get('returnTo');
          navigate(returnTo || '/');
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${PUBLIC_SITE_URL}/`,
            data: {
              name: name.trim(),
              marketing_emails_opt_in: marketingEmailsOptIn,
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
          setSignupName(name.trim());
          setIsSignupStep2(true);
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
        redirectTo: `${PUBLIC_SITE_URL}/reset-password`,
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

  const handleGoogleSignIn = async () => {
    setError('');
    setIsGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${PUBLIC_SITE_URL}/`,
      },
    });
    if (error) {
      setError(error.message);
      setIsGoogleLoading(false);
    }
  };

  const resetForm = () => {
    setError('');
    setEmail('');
    setPassword('');
    setName('');
    setMarketingEmailsOptIn(false);
    setIsResetMode(false);
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateAvatarFile(file);
    if (err) { setAvatarError(err); return; }
    setAvatarError('');
    setAvatarFile(file);
    const preview = await fileToPreviewDataUrl(file);
    setAvatarPreview(preview);
  };

  const finishSignup = async (withAvatar: boolean) => {
    if (withAvatar && avatarFile) {
      await savePendingAvatar(avatarFile);
    }
    toast({
      title: "Account created!",
      description: "Please check your email to confirm your account.",
    });
    setIsSignupStep2(false);
    setAvatarFile(null);
    setAvatarPreview(null);
    setSignupName('');
    setIsLogin(true);
  };

  const handlePostLoginDraftSave = async () => {
    // Check if we should save a draft (from URL param)
    const shouldSaveDraft = searchParams.get('saveDraft') === 'true';
    
    if (!shouldSaveDraft) {
      return;
    }

    // Verify user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.warn('User not authenticated yet, skipping draft save');
      return;
    }

    // Check for pending draft in localStorage
    const pendingDraft = getPendingDraft();
    
    if (!pendingDraft) {
      console.log('No pending draft found in localStorage');
      return;
    }

    try {
      console.log('Saving pending draft after login:', pendingDraft);
      
      // Generate a default title with timestamp if not provided
      const now = new Date();
      const defaultTitle = pendingDraft.draftData.title || 
        `Copy of ${pendingDraft.draftData.option || 'Draft'} - ${now.toLocaleDateString()}`;
      
      // Save the draft directly using supabase (don't rely on hook's user state)
      const { data: draft, error: draftError } = await supabase
        .from('drafts')
        .insert({
          title: defaultTitle,
          theme: pendingDraft.draftData.theme,
          option: pendingDraft.draftData.option,
          participants: pendingDraft.draftData.participants,
          categories: pendingDraft.draftData.categories,
          is_complete: pendingDraft.draftData.isComplete,
          user_id: session.user.id
        })
        .select()
        .single();

      if (draftError) throw draftError;

      // Save picks if any exist, including scoring data
      if (pendingDraft.draftData.picks.length > 0) {
        const picks = pendingDraft.draftData.picks.map((pick: any, index: number) => {
          const pickWithScoring = pick as any;
          return {
            draft_id: draft.id,
            player_id: pick.playerId,
            player_name: pick.playerName,
            movie_id: pick.movie.id,
            movie_title: pick.movie.title,
            movie_year: pick.movie.year,
            movie_genre: pick.movie.genre || 'Unknown',
            category: pick.category,
            pick_order: index + 1,
            poster_path: pick.movie.posterPath || pick.movie.poster_path || null,
            // Include scoring data if available
            calculated_score: pickWithScoring.calculated_score ?? null,
            rt_critics_score: pickWithScoring.rt_critics_score ?? null,
            rt_audience_score: pickWithScoring.rt_audience_score ?? null,
            imdb_rating: pickWithScoring.imdb_rating ?? null,
            metacritic_score: pickWithScoring.metacritic_score ?? null,
            movie_budget: pickWithScoring.movie_budget ?? null,
            movie_revenue: pickWithScoring.movie_revenue ?? null,
            oscar_status: pickWithScoring.oscar_status ?? null,
            scoring_data_complete: pickWithScoring.scoring_data_complete ?? false
          };
        });

        const { error: picksError } = await supabase
          .from('draft_picks')
          .insert(picks);

        if (picksError) throw picksError;
      }

      // Clear the pending draft from localStorage
      clearPendingDraft();

      toast({
        title: "Draft Saved!",
        description: "Your draft has been saved successfully.",
      });
    } catch (error) {
      console.error('Failed to save pending draft after login:', error);
      toast({
        title: "Save Failed",
        description: "Your draft couldn't be saved automatically. You can try saving it again from the draft page.",
        variant: "destructive",
      });
      // Don't clear localStorage on error - user might want to retry
    }
  };

  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
        <title>Movie Drafter - Sign In</title>
        <meta name="description" content="Sign in to Movie Drafter to run fantasy movie drafts and play the movie drafting game with friends." />
        <link rel="canonical" href="https://moviedrafter.com/auth" />
        <meta property="og:title" content="Movie Drafter - Sign In" />
        <meta property="og:description" content="Sign in to Movie Drafter to run fantasy movie drafts and play the movie drafting game with friends." />
        <meta property="og:url" content="https://moviedrafter.com/auth" />
        {socialShareImageMetaNodes()}
        <meta name="twitter:title" content="Movie Drafter - Sign In" />
        <meta name="twitter:description" content="Sign in to Movie Drafter to run fantasy movie drafts and play the movie drafting game with friends." />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center px-4" style={{background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)'}}>
      <style>{`
        input::placeholder {
          color: var(--Text-Light-grey, #BDC3C2) !important;
        }
      `}</style>
      <div className="w-full max-w-md" style={{
        background: 'var(--Section-Container, #0E0E0F)',
        boxShadow: '0px 0px 6px #3B0394',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ paddingTop: '6px' }}>
            <h1 style={{
              textAlign: 'center',
              color: 'var(--Text-Primary, #FCFFFF)',
              fontSize: '20px',
              fontFamily: 'Brockmann',
              fontWeight: '500',
              lineHeight: '28px',
              margin: 0
            }}>
              {isSignupStep2 ? 'Add a profile photo' : isResetMode ? 'Reset password' : isLogin ? 'Sign in' : 'Create account'}
            </h1>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isSignupStep2 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center' }}>
                <p style={{
                  textAlign: 'center',
                  color: 'var(--Text-Light-grey, #BDC3C2)',
                  fontSize: '14px',
                  fontFamily: 'Brockmann',
                  fontWeight: '400',
                  lineHeight: '20px',
                  margin: 0
                }}>
                  You can add a photo now or do it later from your profile.
                </p>

                {/* Avatar preview circle */}
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  style={{
                    width: '96px',
                    height: '96px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: avatarPreview ? 'transparent' : 'var(--UI-Primary, #1D1D1F)',
                    border: '2px dashed var(--Button-Stroke, #666469)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    flexShrink: 0,
                    padding: 0,
                  }}
                >
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <Camera size={20} color="var(--Text-Light-grey, #BDC3C2)" />
                      <span style={{
                        color: 'var(--Text-Light-grey, #BDC3C2)',
                        fontSize: '11px',
                        fontFamily: 'Brockmann',
                        fontWeight: '400',
                      }}>
                        {getInitials(signupName, null)}
                      </span>
                    </div>
                  )}
                </button>

                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleAvatarFileChange}
                  style={{ display: 'none' }}
                />

                {avatarError && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    background: '#FEE2E2',
                    border: '1px solid #EF4444',
                    borderRadius: '4px',
                    color: '#DC2626',
                    fontSize: '13px',
                    width: '100%'
                  }}>
                    <AlertCircle size={14} />
                    {avatarError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  style={{
                    padding: '8px 20px',
                    background: 'transparent',
                    border: '1px solid var(--Button-Stroke, #666469)',
                    borderRadius: '2px',
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: '500',
                    cursor: 'pointer',
                  }}
                >
                  {avatarFile ? 'Change photo' : 'Choose photo'}
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                  <button
                    type="button"
                    onClick={() => finishSignup(true)}
                    disabled={!avatarFile}
                    style={{
                      padding: '12px 24px',
                      background: avatarFile ? 'var(--Brand-Primary, #7142FF)' : 'var(--UI-Primary, #1D1D1F)',
                      borderRadius: '2px',
                      border: 'none',
                      color: 'var(--Text-Primary, #FCFFFF)',
                      fontSize: '16px',
                      fontFamily: 'Brockmann',
                      fontWeight: '600',
                      lineHeight: '24px',
                      letterSpacing: '0.32px',
                      cursor: avatarFile ? 'pointer' : 'not-allowed',
                      opacity: avatarFile ? 1 : 0.4,
                      width: '100%',
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    Continue
                  </button>

                  <button
                    type="button"
                    onClick={() => finishSignup(false)}
                    style={{
                      padding: '8px 16px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--Text-Light-grey, #BDC3C2)',
                      fontSize: '14px',
                      fontFamily: 'Brockmann',
                      fontWeight: '400',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Skip for now
                  </button>
                </div>
              </div>
            ) : isResetMode ? (
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
                     color: 'var(--Text-Primary, #FCFFFF)',
                     fontSize: '14px',
                     fontFamily: 'Brockmann',
                     fontWeight: '500',
                     lineHeight: '20px'
                   }}>Email</div>
                   <div style={{
                     padding: '12px 16px',
                     background: 'var(--UI-Primary, #1D1D1F)',
                     borderRadius: '2px',
                     outline: '1px var(--Button-Stroke, #666469) solid',
                     outlineOffset: '-1px'
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
                         color: 'var(--Text-Primary, #FCFFFF)',
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
                     background: 'var(--Brand-Primary, #7142FF)',
                     borderRadius: '2px',
                     border: 'none',
                     color: 'var(--Text-Primary, #FCFFFF)',
                     fontSize: '16px',
                     fontFamily: 'Brockmann',
                     fontWeight: '600',
                     lineHeight: '24px',
                     letterSpacing: '0.32px',
                     cursor: loading ? 'not-allowed' : 'pointer',
                     opacity: loading ? 0.7 : 1,
                     width: '100%'
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
                     borderRadius: '6px',
                     color: 'var(--Brand-Primary, #7142FF)',
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
              <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
                onMouseEnter={() => !isGoogleLoading && setIsGoogleButtonHovered(true)}
                onMouseLeave={() => setIsGoogleButtonHovered(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '12px 24px',
                  background: isGoogleButtonHovered && !isGoogleLoading ? '#2A2A2D' : 'var(--UI-Primary, #1D1D1F)',
                  border: '1px solid var(--Button-Stroke, #666469)',
                  borderRadius: '2px',
                  color: 'var(--Text-Primary, #FCFFFF)',
                  fontSize: '16px',
                  fontFamily: 'Brockmann',
                  fontWeight: '600',
                  lineHeight: '24px',
                  letterSpacing: '0.32px',
                  cursor: isGoogleLoading ? 'not-allowed' : 'pointer',
                  opacity: isGoogleLoading ? 0.7 : 1,
                  transition: 'background-color 0.2s ease',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
                </svg>
                {isGoogleLoading ? 'Redirecting...' : 'Continue with Google'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--Button-Stroke, #666469)' }} />
                <span style={{
                  color: 'var(--Text-Light-grey, #BDC3C2)',
                  fontSize: '13px',
                  fontFamily: 'Brockmann',
                  fontWeight: '400',
                }}>or</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--Button-Stroke, #666469)' }} />
              </div>

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
                     color: 'var(--Text-Primary, #FCFFFF)',
                     fontSize: '14px',
                     fontFamily: 'Brockmann',
                     fontWeight: '500',
                     lineHeight: '20px'
                   }}>Email</div>
                   <div style={{
                     padding: '12px 16px',
                     background: 'var(--UI-Primary, #1D1D1F)',
                     borderRadius: '2px',
                     outline: '1px var(--Button-Stroke, #666469) solid',
                     outlineOffset: '-1px'
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
                         color: 'var(--Text-Primary, #FCFFFF)',
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
                       color: 'var(--Text-Primary, #FCFFFF)',
                       fontSize: '14px',
                       fontFamily: 'Brockmann',
                       fontWeight: '500',
                       lineHeight: '20px'
                     }}>Name</div>
                     <div style={{
                       padding: '12px 16px',
                       background: 'var(--UI-Primary, #1D1D1F)',
                       borderRadius: '2px',
                       outline: '1px var(--Button-Stroke, #666469) solid',
                       outlineOffset: '-1px'
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
                           color: 'var(--Text-Primary, #FCFFFF)',
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
                     color: 'var(--Text-Primary, #FCFFFF)',
                     fontSize: '14px',
                     fontFamily: 'Brockmann',
                     fontWeight: '500',
                     lineHeight: '20px'
                   }}>Password</div>
                   <div style={{
                     padding: '12px 16px',
                     background: 'var(--UI-Primary, #1D1D1F)',
                     borderRadius: '2px',
                     outline: '1px var(--Button-Stroke, #666469) solid',
                     outlineOffset: '-1px'
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
                         color: 'var(--Text-Primary, #FCFFFF)',
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

                {!isLogin && (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      cursor: 'pointer',
                      paddingTop: '4px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={marketingEmailsOptIn}
                      onChange={(e) => setMarketingEmailsOptIn(e.target.checked)}
                      style={{
                        marginTop: '3px',
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        color: 'var(--Text-Light-grey, #BDC3C2)',
                        fontSize: '13px',
                        fontFamily: 'Brockmann',
                        fontWeight: '400',
                        lineHeight: '20px',
                      }}
                    >
                      I want to receive product updates and occasional news from Movie Drafter. See our{' '}
                      <Link
                        to="/privacy-policy"
                        style={{ color: 'var(--Brand-Primary, #7142FF)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Privacy Policy
                      </Link>
                      .
                    </span>
                  </label>
                )}

                {isLogin && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                     <button
                       type="button"
                       onClick={() => setIsResetMode(true)}
                       onMouseEnter={() => setIsForgotPasswordHovered(true)}
                       onMouseLeave={() => setIsForgotPasswordHovered(false)}
                       style={{
                         background: 'transparent',
                         border: 'none',
                         borderRadius: '6px',
                         color: isForgotPasswordHovered ? 'hsl(var(--Hover))' : 'var(--Text-Light-grey, #BDC3C2)',
                         fontSize: '14px',
                         fontFamily: 'Brockmann',
                         fontWeight: '400',
                         lineHeight: '24px',
                         cursor: 'pointer',
                         padding: '0',
                         transition: 'color 0.2s ease'
                       }}
                     >
                       Forgot your password?
                     </button>
                  </div>
                )}

                 <button
                   type="submit"
                   disabled={loading}
                   onMouseEnter={() => !loading && setIsButtonHovered(true)}
                   onMouseLeave={() => setIsButtonHovered(false)}
                   style={{
                     padding: '12px 24px',
                     background: isButtonHovered && !loading ? 'hsl(var(--Hover))' : 'var(--Brand-Primary, #7142FF)',
                     borderRadius: '2px',
                     border: 'none',
                     color: 'var(--Text-Primary, #FCFFFF)',
                     fontSize: '16px',
                     fontFamily: 'Brockmann',
                     fontWeight: '600',
                     lineHeight: '24px',
                     letterSpacing: '0.32px',
                     cursor: loading ? 'not-allowed' : 'pointer',
                     opacity: loading ? 0.7 : 1,
                     width: '100%',
                     transition: 'background-color 0.2s ease'
                   }}
                 >
                   {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Sign Up')}
                 </button>
              </form>
              </>
            )}

            {!isResetMode && !isSignupStep2 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                 <div style={{ 
                   textAlign: 'center',
                   color: 'var(--Text-Light-grey, #BDC3C2)',
                   fontSize: '14px',
                   fontFamily: 'Brockmann',
                   fontWeight: '400',
                   lineHeight: '20px',
                   marginBottom: '6px'
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
                     setMarketingEmailsOptIn(false);
                   }}
                   onMouseEnter={() => setIsTextButtonHovered(true)}
                   onMouseLeave={() => setIsTextButtonHovered(false)}
                   style={{
                     height: '40px',
                     padding: '6px 16px 8px 16px',
                     background: 'transparent',
                     border: 'none',
                     borderRadius: '6px',
                     color: isTextButtonHovered ? 'hsl(var(--Hover))' : 'var(--Brand-Primary, #7142FF)',
                     fontSize: '16px',
                     fontFamily: 'Brockmann',
                     fontWeight: '600',
                     lineHeight: '24px',
                     letterSpacing: '0.32px',
                     cursor: 'pointer',
                     transition: 'color 0.2s ease'
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
    </>
  );
};

export default Auth;
