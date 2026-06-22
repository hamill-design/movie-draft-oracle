import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

// Lets the in-app browser dismiss itself once the OAuth redirect returns.
WebBrowser.maybeCompleteAuthSession();

// Where Supabase sends the user back to after Google sign-in. In a dev/prod
// build this is `moviedrafter://`; in Expo Go it's an `exp://` URL.
const redirectTo = makeRedirectUri();

// Pull token/code params out of a URL's query (?a=b) and/or fragment (#a=b).
function parseUrlParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const segment of url.split(/[?#]/).slice(1)) {
    for (const pair of segment.split("&")) {
      const [key, value] = pair.split("=");
      if (key) out[decodeURIComponent(key)] = decodeURIComponent(value ?? "");
    }
  }
  return out;
}

// Turn the redirect URL Supabase sends back into a real session. Handles both
// the PKCE flow (?code=...) and the implicit flow (#access_token=...).
async function createSessionFromUrl(url: string) {
  const params = parseUrlParams(url);
  if (params.error_description) throw new Error(params.error_description);

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return data.session;
  }

  if (!params.access_token) return null;
  const { data, error } = await supabase.auth.setSession({
    access_token: params.access_token,
    refresh_token: params.refresh_token,
  });
  if (error) throw error;
  return data.session;
}

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // If the app is resumed via the OAuth deep link, complete the session.
  const incomingUrl = Linking.useURL();
  useEffect(() => {
    if (incomingUrl) {
      createSessionFromUrl(incomingUrl).catch(() => {
        /* not an auth redirect — ignore */
      });
    }
  }, [incomingUrl]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });

    return () => {
      sub.subscription.unsubscribe();
      appState.remove();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  };

  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) return { error: error.message };
      if (!data?.url) return { error: "Could not start Google sign-in." };

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === "success") {
        await createSessionFromUrl(result.url);
      }
      // Any other result (dismiss/cancel) just returns the user to login.
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Google sign-in failed." };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
