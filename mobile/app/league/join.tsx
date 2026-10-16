import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle2, Trophy, XCircle } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useLeagueActions } from "../../hooks/useLeagues";
import { setPendingRoute } from "../../lib/pendingRoute";
import { colors } from "../../lib/theme";
import { AppHeader, Button, Field, GlowCard, Text } from "../../components/ui";

// Accepts a bare token or a full invite link (https://moviedrafter.com/league/join?token=...).
function extractToken(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/[?&]token=([^&#\s]+)/);
  return match ? decodeURIComponent(match[1]) : trimmed;
}

type State = "idle" | "joining" | "needs-auth" | "success" | "error";

function IconCircle({ tint, children }: { tint: string; children: React.ReactNode }) {
  return (
    <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: tint, alignItems: "center", justifyContent: "center" }}>
      {children}
    </View>
  );
}

// Same states and copy as the website's invite-link page, plus a paste-the-link box
// (invite links don't always open the app).
export default function JoinLeague() {
  const router = useRouter();
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();
  const { session, loading: authLoading } = useAuth();
  const { acceptInviteByToken } = useLeagueActions();

  const [input, setInput] = useState("");
  const [state, setState] = useState<State>(tokenParam ? "joining" : "idle");
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [token, setToken] = useState<string | null>(tokenParam ?? null);
  const attempted = useRef<string | null>(null);

  const join = async (raw: string) => {
    const t = extractToken(raw);
    if (!t) return;
    setToken(t);
    if (!session) {
      setState("needs-auth");
      return;
    }
    setState("joining");
    const id = await acceptInviteByToken(t);
    if (id) {
      setLeagueId(id);
      setState("success");
    } else {
      setErrorMsg("This invite link is invalid, has already been used, or has expired.");
      setState("error");
    }
  };

  // Opened from an invite link: join automatically once we know who's signed in.
  useEffect(() => {
    if (authLoading || !tokenParam || attempted.current === tokenParam) return;
    attempted.current = tokenParam;
    join(tokenParam);
  }, [authLoading, tokenParam, session]);

  const signInToJoin = async () => {
    if (token) await setPendingRoute(`/league/join?token=${encodeURIComponent(token)}`);
    router.replace("/login");
  };

  return (
    <View className="flex-1">
      <AppHeader backHref="/leagues" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 16 }} keyboardShouldPersistTaps="handled">
        <GlowCard style={{ width: "100%", maxWidth: 448, alignSelf: "center", alignItems: "center", paddingVertical: 32 }}>
          {state === "idle" && (
            <View style={{ width: "100%", gap: 16 }}>
              <Text className="text-center font-brockmann-semibold text-xl">Join a league</Text>
              <Text className="text-center text-sm text-greyscale-blue-300">Paste the invite link a friend sent you.</Text>
              <Field
                value={input}
                onChangeText={setInput}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="https://moviedrafter.com/league/join?token=…"
              />
              <Button label="Join league" variant="brand" disabled={!input.trim()} onPress={() => join(input)} />
            </View>
          )}

          {state === "joining" && (
            <View className="items-center gap-4">
              <ActivityIndicator color={colors.brand} size="large" />
              <Text className="text-sm text-greyscale-blue-300">Joining league…</Text>
            </View>
          )}

          {state === "needs-auth" && (
            <View style={{ width: "100%", alignItems: "center", gap: 24 }}>
              <IconCircle tint="rgba(113,66,255,0.1)">
                <Trophy size={28} color={colors.brand} />
              </IconCircle>
              <View className="items-center gap-2">
                <Text className="text-center font-brockmann-semibold text-xl">You've been invited to a league</Text>
                <Text className="text-center text-sm text-greyscale-blue-300">
                  Sign in or create an account to accept this invite.
                </Text>
              </View>
              <View className="w-full">
                <Button label="Sign in to join" variant="brand" onPress={signInToJoin} />
              </View>
            </View>
          )}

          {state === "success" && (
            <View style={{ width: "100%", alignItems: "center", gap: 24 }}>
              <IconCircle tint="rgba(19,206,102,0.15)">
                <CheckCircle2 size={28} color="#13CE66" />
              </IconCircle>
              <View className="items-center gap-2">
                <Text className="text-center font-brockmann-semibold text-xl">You've joined the league!</Text>
                <Text className="text-center text-sm text-greyscale-blue-300">
                  You're now a member. Check the standings and start competing.
                </Text>
              </View>
              <View className="w-full">
                <Button label="Go to league" variant="brand" onPress={() => router.replace(`/league/${leagueId}`)} />
              </View>
            </View>
          )}

          {state === "error" && (
            <View style={{ width: "100%", alignItems: "center", gap: 24 }}>
              <IconCircle tint="rgba(255,66,66,0.12)">
                <XCircle size={28} color="#FF4242" />
              </IconCircle>
              <View className="items-center gap-2">
                <Text className="text-center font-brockmann-semibold text-xl">Invite not valid</Text>
                <Text className="text-center text-sm text-greyscale-blue-300">{errorMsg}</Text>
              </View>
              <View className="w-full gap-3">
                <Button label="Try another link" variant="brand" onPress={() => setState("idle")} />
                <Button label="Go home" variant="outline" onPress={() => router.replace("/leagues")} />
              </View>
            </View>
          )}
        </GlowCard>
      </ScrollView>
    </View>
  );
}
