import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

/** Supabase recovery links put tokens in the URL hash (#access_token=…); query params are optional. */
function getTokensFromUrl(searchParams: URLSearchParams): {
  access_token: string | null;
  refresh_token: string | null;
} {
  let access = searchParams.get('access_token');
  let refresh = searchParams.get('refresh_token');
  if (access && refresh) {
    return { access_token: access, refresh_token: refresh };
  }

  const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
  if (hash) {
    const fromHash = new URLSearchParams(hash);
    access = fromHash.get('access_token');
    refresh = fromHash.get('refresh_token');
    if (access && refresh) {
      return { access_token: access, refresh_token: refresh };
    }
  }

  return { access_token: null, refresh_token: null };
}

function stripAuthFromAddressBar() {
  if (typeof window === 'undefined') return;
  const { pathname, search } = window.location;
  window.history.replaceState(null, '', pathname + search);
}

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitHovered, setIsSubmitHovered] = useState(false);
  const [isGoHomeHovered, setIsGoHomeHovered] = useState(false);
  const [isBackHovered, setIsBackHovered] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    const establishSession = async () => {
      const { access_token: accessToken, refresh_token: refreshToken } = getTokensFromUrl(searchParams);

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (cancelled) return;
        if (sessionError) {
          setError(
            sessionError.message ||
              'Invalid reset link. Please request a new password reset.'
          );
          return;
        }
        setError('');
        stripAuthFromAddressBar();
        return;
      }

      const code = searchParams.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );
        if (cancelled) return;
        if (exchangeError) {
          setError(
            exchangeError.message ||
              'Invalid reset link. Please request a new password reset.'
          );
          return;
        }
        setError('');
        stripAuthFromAddressBar();
        return;
      }

      // Hash/query already consumed (e.g. React Strict Mode remount) but session was established.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) {
        setError('');
        return;
      }

      if (!cancelled) {
        setError('Invalid reset link. Please request a new password reset.');
      }
    };

    void establishSession();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
        toast({
          title: 'Password updated!',
          description: 'Your password has been successfully updated.',
        });

        setTimeout(() => {
          navigate('/');
        }, 2000);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const cardShell = (children: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)' }}>
      <style>{`
        input::placeholder {
          color: var(--Text-Light-grey, #BDC3C2) !important;
        }
      `}</style>
      <div
        className="w-full max-w-md"
        style={{
          background: 'var(--Section-Container, #0E0E0F)',
          boxShadow: '0px 0px 6px #3B0394',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>{children}</div>
      </div>
    </div>
  );

  const helmet = (
    <Helmet>
        <meta name="robots" content="noindex, nofollow" />
        <title>Movie Drafter - Reset Password</title>
        <meta name="description" content="Reset your Movie Drafter password to regain access to your account and continue creating movie drafts." />
        <link rel="canonical" href="https://moviedrafter.com/reset-password" />
        <meta property="og:title" content="Movie Drafter - Reset Password" />
        <meta property="og:description" content="Reset your Movie Drafter password to regain access to your account and continue creating movie drafts." />
        <meta property="og:url" content="https://moviedrafter.com/reset-password" />
        {socialShareImageMetaNodes()}
        <meta name="twitter:title" content="Movie Drafter - Reset Password" />
        <meta name="twitter:description" content="Reset your Movie Drafter password to regain access to your account and continue creating movie drafts." />
    </Helmet>
  );

  if (success) {
    return (
      <>
        {helmet}
        {cardShell(
          <>
            <div style={{ paddingTop: '6px', textAlign: 'center' }}>
              <CheckCircle className="mx-auto mb-4 text-green-400" size={48} strokeWidth={1.5} />
              <h1
                style={{
                  color: 'var(--Text-Primary, #FCFFFF)',
                  fontSize: '20px',
                  fontFamily: 'Brockmann',
                  fontWeight: '500',
                  lineHeight: '28px',
                  margin: 0,
                }}
              >
                Password updated
              </h1>
              <p
                style={{
                  marginTop: '12px',
                  color: 'var(--Text-Light-grey, #BDC3C2)',
                  fontSize: '14px',
                  fontFamily: 'Brockmann',
                  fontWeight: '400',
                  lineHeight: '20px',
                }}
              >
                You will be redirected to the home page shortly.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/')}
              onMouseEnter={() => setIsGoHomeHovered(true)}
              onMouseLeave={() => setIsGoHomeHovered(false)}
              style={{
                padding: '12px 24px',
                background: isGoHomeHovered ? 'hsl(var(--Hover))' : 'var(--Brand-Primary, #7142FF)',
                borderRadius: '2px',
                border: 'none',
                color: 'var(--Text-Primary, #FCFFFF)',
                fontSize: '16px',
                fontFamily: 'Brockmann',
                fontWeight: '600',
                lineHeight: '24px',
                letterSpacing: '0.32px',
                cursor: 'pointer',
                width: '100%',
                transition: 'background-color 0.2s ease',
              }}
            >
              Go to home
            </button>
          </>
        )}
      </>
    );
  }

  return (
    <>
      {helmet}
      {cardShell(
        <>
          <div style={{ paddingTop: '6px' }}>
            <h1
              style={{
                textAlign: 'center',
                color: 'var(--Text-Primary, #FCFFFF)',
                fontSize: '20px',
                fontFamily: 'Brockmann',
                fontWeight: '500',
                lineHeight: '28px',
                margin: 0,
              }}
            >
              Set new password
            </h1>
            <p
              style={{
                textAlign: 'center',
                marginTop: '8px',
                marginBottom: 0,
                color: 'var(--Text-Light-grey, #BDC3C2)',
                fontSize: '14px',
                fontFamily: 'Brockmann',
                fontWeight: '400',
                lineHeight: '20px',
              }}
            >
              Choose a password you have not used before on this site.
            </p>
          </div>

          <form onSubmit={handlePasswordUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px',
                  background: '#FEE2E2',
                  border: '1px solid #EF4444',
                  borderRadius: '4px',
                  color: '#DC2626',
                  fontSize: '14px',
                }}
              >
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div style={{ paddingTop: '3px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
              <div
                style={{
                  color: 'var(--Text-Primary, #FCFFFF)',
                  fontSize: '14px',
                  fontFamily: 'Brockmann',
                  fontWeight: '500',
                  lineHeight: '20px',
                }}
              >
                New password
              </div>
              <div
                style={{
                  padding: '12px 16px',
                  background: 'var(--UI-Primary, #1D1D1F)',
                  borderRadius: '2px',
                  outline: '1px var(--Button-Stroke, #666469) solid',
                  outlineOffset: '-1px',
                }}
              >
                <input
                  type="password"
                  placeholder="Enter your new password"
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
                    lineHeight: '20px',
                  }}
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div style={{ paddingTop: '3px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
              <div
                style={{
                  color: 'var(--Text-Primary, #FCFFFF)',
                  fontSize: '14px',
                  fontFamily: 'Brockmann',
                  fontWeight: '500',
                  lineHeight: '20px',
                }}
              >
                Confirm new password
              </div>
              <div
                style={{
                  padding: '12px 16px',
                  background: 'var(--UI-Primary, #1D1D1F)',
                  borderRadius: '2px',
                  outline: '1px var(--Button-Stroke, #666469) solid',
                  outlineOffset: '-1px',
                }}
              >
                <input
                  type="password"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: 'var(--Text-Primary, #FCFFFF)',
                    fontSize: '14px',
                    fontFamily: 'Brockmann',
                    fontWeight: '500',
                    lineHeight: '20px',
                  }}
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              onMouseEnter={() => !loading && setIsSubmitHovered(true)}
              onMouseLeave={() => setIsSubmitHovered(false)}
              style={{
                padding: '12px 24px',
                background: isSubmitHovered && !loading ? 'hsl(var(--Hover))' : 'var(--Brand-Primary, #7142FF)',
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
                transition: 'background-color 0.2s ease',
              }}
            >
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => navigate('/auth')}
              onMouseEnter={() => setIsBackHovered(true)}
              onMouseLeave={() => setIsBackHovered(false)}
              style={{
                padding: '6px 16px',
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: isBackHovered ? 'hsl(var(--Hover))' : 'var(--Brand-Primary, #7142FF)',
                fontSize: '16px',
                fontFamily: 'Brockmann',
                fontWeight: '600',
                lineHeight: '24px',
                letterSpacing: '0.32px',
                cursor: 'pointer',
                transition: 'color 0.2s ease',
              }}
            >
              Back to sign in
            </button>
          </div>
        </>
      )}
    </>
  );
};

export default ResetPassword;
