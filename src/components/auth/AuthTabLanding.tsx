import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { IS_AUTH_TAB } from '@/lib/authRedirect';

/**
 * What the new tab shows after Google sign-in (the sign-in popup opens Google in a tab so the page behind it is never lost).
 * Once the account is signed in it closes itself; the original tab hears about the sign-in and carries on from there.
 * Renders nothing in any other tab. The original tab, not this one, saves a guest's stashed draft (see PendingDraftProcessor).
 */
export function AuthTabLanding() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (IS_AUTH_TAB && user) window.close();
  }, [user]);

  if (!IS_AUTH_TAB) return null;

  const message = user
    ? "You're signed in. You can close this tab and go back to where you were."
    : loading
      ? 'Finishing sign-in...'
      : "Sign-in didn't finish. You can close this tab and try again.";

  return (
    <div
      role="status"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 px-6 text-center"
      style={{ background: 'linear-gradient(140deg, #100029 16%, #160038 50%, #100029 83%)' }}
    >
      <p className="m-0 font-brockmann text-lg text-white">{message}</p>
      {!loading && (
        <button
          type="button"
          onClick={() => window.close()}
          className="rounded-[2px] bg-[#7142FF] px-6 py-3 font-brockmann text-base font-semibold text-white hover:bg-[#794DFF]"
        >
          Close this tab
        </button>
      )}
    </div>
  );
}
