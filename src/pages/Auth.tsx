import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { socialShareImageMetaNodes } from '@/components/seo/SocialShareImageMeta';
import { supabase } from '@/integrations/supabase/client';
import { AuthForm } from '@/components/auth/AuthForm';
import { safeReturnTo } from '@/lib/authRedirect';

/**
 * The full-page sign-in. Used for links that have to land on a page (email invites, password reset,
 * the header's Sign in). In-page moments (Final Scores, Quick Play) use the sign-in popup instead (AuthModal).
 */
const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'));

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        navigate(returnTo || '/');
      }
    };

    checkAuth();
  }, [navigate, returnTo]);

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
        <div className="w-full max-w-md" style={{
          background: 'var(--Section-Container, #0E0E0F)',
          boxShadow: 'var(--shadow-card-glow)',
          borderRadius: 'var(--radius-card)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '24px' }}>
            <AuthForm
              // Email invite links land here with ?email=<invited email>&mode=signup so a
              // brand-new invitee registers with the address the invite was sent to.
              initialMode={searchParams.get('mode') === 'signup' ? 'signup' : 'signin'}
              initialEmail={searchParams.get('email') ?? ''}
              returnTo={returnTo}
              saveDraft={searchParams.get('saveDraft') === 'true'}
              onSignedIn={() => navigate(returnTo || '/')}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default Auth;
