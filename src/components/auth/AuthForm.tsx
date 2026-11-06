import React, { useState, useRef, useEffect } from 'react';
import { AlertCircle, Camera } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { savePendingDraftForUser } from '@/utils/savePendingDraftForUser';
import { savePendingAvatar, validateAvatarFile, fileToPreviewDataUrl, getInitials } from '@/utils/avatarUpload';
import { PUBLIC_SITE_URL, safeReturnTo, withAuthTabFlag } from '@/lib/authRedirect';

export type AuthMode = 'signin' | 'signup';

export interface AuthFormProps {
  /** Which screen to start on. */
  initialMode?: AuthMode;
  /** Pre-fills the email field (email invite links hand this over). */
  initialEmail?: string;
  /** Same-site path that Google and email-confirmation links bring the person back to. Defaults to the homepage. */
  returnTo?: string | null;
  /** After a password sign-in, save the draft a guest stashed in this browser to the account. */
  saveDraft?: boolean;
  /** Called after a successful password sign-in (and the draft save, if asked for). Google leaves the site, so it never calls this. */
  onSignedIn: () => void;
  /** Renders the heading: the page uses an h1, the popup uses its dialog title. */
  renderTitle?: (text: string, style: React.CSSProperties) => React.ReactNode;
  /** Replaces the "Sign in" heading, e.g. "Sign in to join this game". */
  signInTitle?: string;
  /** A line of context under the heading on the sign-in and create-account screens. */
  intro?: React.ReactNode;
  /** Open the privacy-policy link in a new tab so a half-filled form is not lost (used in the popup). */
  linksInNewTab?: boolean;
  /**
   * Open Google sign-in in a new tab instead of leaving this page (used in the popup, so the page behind it,
   * like Final Scores, is never lost). `onSignedIn` runs here once the new tab has finished signing in.
   */
  googleInNewTab?: boolean;
}

const titleStyle: React.CSSProperties = {
  textAlign: 'center',
  color: 'var(--Text-Primary, #FCFFFF)',
  fontSize: '20px',
  fontFamily: 'Brockmann',
  fontWeight: '500',
  lineHeight: '28px',
  margin: 0,
};

const defaultRenderTitle = (text: string, style: React.CSSProperties) => <h1 style={style}>{text}</h1>;

/**
 * Sign in / create account / forgot password, with Google. The inside of the sign-in page and of the sign-in popup.
 * It never navigates: the caller decides what happens after a password sign-in (`onSignedIn`).
 */
export function AuthForm({
  initialMode = 'signin',
  initialEmail = '',
  returnTo = null,
  saveDraft = false,
  onSignedIn,
  renderTitle = defaultRenderTitle,
  signInTitle,
  intro,
  linksInNewTab = false,
  googleInNewTab = false,
}: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(initialMode !== 'signup');
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [marketingEmailsOptIn, setMarketingEmailsOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isButtonHovered, setIsButtonHovered] = useState(false);
  const [isGoogleButtonHovered, setIsGoogleButtonHovered] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  // Google sign-in is open in its own tab and we are waiting for it to finish.
  const [waitingForGoogleTab, setWaitingForGoogleTab] = useState(false);
  const stopWatchingGoogleTab = useRef<(() => void) | null>(null);
  const [isTextButtonHovered, setIsTextButtonHovered] = useState(false);
  const [isForgotPasswordHovered, setIsForgotPasswordHovered] = useState(false);
  const [isSignupStep2, setIsSignupStep2] = useState(false);
  const [signupName, setSignupName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  // Where Google and the confirmation email send the person back to.
  const destination = safeReturnTo(returnTo) || '/';

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
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

          // signInWithPassword already returns the new session, so use it
          // directly rather than re-checking via getSession() (which can
          // hang indefinitely if a stale saved session left Supabase's
          // internal auth lock stuck on mobile).
          if (saveDraft && data.session) {
            await savePendingDraftForUser(data.session.user.id);
          }

          onSignedIn();
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${PUBLIC_SITE_URL}${destination}`,
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

  // Waits for the Google tab to finish. The new tab signs in and Supabase tells every open tab, this one included
  // (`SIGNED_IN`). If the tab is closed first, we check whether it got as far as signing in before giving up.
  const watchGoogleTab = (tab: Window) => {
    stopWatchingGoogleTab.current?.();
    let finished = false;
    const stop = () => {
      subscription.unsubscribe();
      window.clearInterval(timer);
      stopWatchingGoogleTab.current = null;
    };
    const signedIn = () => {
      if (finished) return;
      finished = true;
      stop();
      setWaitingForGoogleTab(false);
      onSignedIn();
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') signedIn();
    });
    const timer = window.setInterval(async () => {
      if (!tab.closed || finished) return;
      const { data } = await supabase.auth.getSession();
      if (finished) return;
      if (data.session) {
        signedIn();
      } else {
        finished = true;
        stop();
        setWaitingForGoogleTab(false);
        setIsGoogleLoading(false);
      }
    }, 500);
    stopWatchingGoogleTab.current = stop;
  };

  useEffect(() => () => stopWatchingGoogleTab.current?.(), []);

  const handleGoogleSignIn = async () => {
    setError('');
    setIsGoogleLoading(true);

    // Open the blank tab right now, while the click still counts (browsers block tabs opened after a wait).
    // If it is blocked, fall back to leaving this page, as the sign-in page does.
    const tab = googleInNewTab ? window.open('', '_blank') : null;
    const viaTab = tab !== null;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${PUBLIC_SITE_URL}${viaTab ? withAuthTabFlag(destination) : destination}`,
        skipBrowserRedirect: viaTab,
      },
    });
    if (error || (viaTab && !data?.url)) {
      tab?.close();
      setError(error?.message ?? 'Could not start Google sign-in. Please try again.');
      setIsGoogleLoading(false);
      return;
    }
    if (tab && data?.url) {
      tab.location.href = data.url;
      setWaitingForGoogleTab(true);
      watchGoogleTab(tab);
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

  const titleText = isSignupStep2
    ? 'Add a profile photo'
    : isResetMode
      ? 'Reset password'
      : isLogin
        ? (signInTitle ?? 'Sign in')
        : 'Create account';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        input::placeholder {
          color: var(--Text-Light-grey, #BDC3C2) !important;
        }
      `}</style>
      <div style={{ paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {renderTitle(titleText, titleStyle)}
        {intro && !isSignupStep2 && !isResetMode && (
          <p style={{
            textAlign: 'center',
            color: 'var(--Text-Light-grey, #BDC3C2)',
            fontSize: '14px',
            fontFamily: 'Brockmann',
            fontWeight: '400',
            lineHeight: '20px',
            margin: 0
          }}>
            {intro}
          </p>
        )}
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
            {waitingForGoogleTab ? 'Waiting for Google...' : isGoogleLoading ? 'Redirecting...' : 'Continue with Google'}
          </button>

          {waitingForGoogleTab && (
            <p style={{
              margin: 0,
              textAlign: 'center',
              color: 'var(--Text-Light-grey, #BDC3C2)',
              fontSize: '13px',
              fontFamily: 'Brockmann',
              fontWeight: '400',
              lineHeight: '20px'
            }}>
              Finish signing in with Google in the new tab. This page stays right here and updates when you are done.
            </p>
          )}

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
                    target={linksInNewTab ? '_blank' : undefined}
                    rel={linksInNewTab ? 'noopener noreferrer' : undefined}
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
  );
}
