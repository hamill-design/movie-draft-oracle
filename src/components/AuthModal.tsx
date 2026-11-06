import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { AuthForm, type AuthMode } from '@/components/auth/AuthForm';
import { safeReturnTo } from '@/lib/authRedirect';

export interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Start on "Sign in" (default) or "Create account". */
  initialMode?: AuthMode;
  /**
   * Where the person ends up after signing in or creating an account (a path on this site, e.g. "/play?quick=play").
   * If it is the page they are already on they simply stay; Google and confirmation emails always come back here.
   */
  returnTo?: string | null;
  /** Save the draft a guest stashed in this browser to the account after a password sign-in (Final Scores). */
  saveDraft?: boolean;
  /** Replaces the "Sign in" heading, e.g. "Sign in to join this game". */
  signInTitle?: string;
  /** A line of context under the heading. */
  intro?: ReactNode;
  /** Runs after a password sign-in, once the popup has closed. */
  onAuthenticated?: () => void;
}

/**
 * Sign in or create an account without leaving the page. Same form as the /auth page, in a popup.
 * Google sign-in opens in a new tab so this page is never lost; that tab closes itself when it is done and this
 * page updates (see AuthTabLanding). If the browser blocks the new tab, Google takes over this page instead and
 * comes back to `returnTo`, so anything that must survive that (like a guest's unsaved draft) is stashed first.
 */
export function AuthModal({
  open,
  onOpenChange,
  initialMode = 'signin',
  returnTo = null,
  saveDraft = false,
  signInTitle,
  intro,
  onAuthenticated,
}: AuthModalProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignedIn = () => {
    onOpenChange(false);
    const target = safeReturnTo(returnTo);
    if (target && target !== `${location.pathname}${location.search}`) navigate(target);
    onAuthenticated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[#49474B] bg-[#0E0E0F] text-white sm:max-w-[448px]">
        <DialogDescription className="sr-only">Sign in or create a free Movie Drafter account.</DialogDescription>
        <AuthForm
          initialMode={initialMode}
          returnTo={returnTo}
          saveDraft={saveDraft}
          signInTitle={signInTitle}
          intro={intro}
          linksInNewTab
          googleInNewTab
          onSignedIn={handleSignedIn}
          renderTitle={(text, style) => (
            <DialogTitle className="tracking-normal" style={style}>
              {text}
            </DialogTitle>
          )}
        />
      </DialogContent>
    </Dialog>
  );
}
