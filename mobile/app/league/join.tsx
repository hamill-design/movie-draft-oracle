import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useLeagueActions } from "../../hooks/useLeagues";
import { Button, ScreenHeader } from "../../components/ui";

// Accepts a bare token or a full invite link (https://moviedrafter.com/league/join?token=...)
// and returns just the token.
function extractToken(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/[?&]token=([^&#\s]+)/);
  return match ? decodeURIComponent(match[1]) : trimmed;
}

// Opened two ways: from the "Join league" button (paste an invite link), or by
// tapping an invite link that carries ?token=… (moviedrafter://league/join?token=…).
export default function JoinLeague() {
  const router = useRouter();
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();
  const { session, loading: authLoading } = useAuth();
  const { acceptInviteByToken } = useLeagueActions();

  const [input, setInput] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoTried = useRef(false);

  const join = async (raw: string) => {
    const token = extractToken(raw);
    if (!token || joining) return;
    setJoining(true);
    setError(null);
    const leagueId = await acceptInviteByToken(token);
    if (leagueId) {
      router.replace(`/league/${leagueId}`);
      return;
    }
    setJoining(false);
    setError("This invite is invalid, has already been used, or has expired.");
  };

  // Came in through an invite link: sign-in first if needed, then join automatically.
  useEffect(() => {
    if (authLoading || autoTried.current || !tokenParam) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    autoTried.current = true;
    join(tokenParam);
  }, [authLoading, session, tokenParam]);

  if (tokenParam && joining) {
    return (
      <View className="flex-1 bg-ink">
        <ScreenHeader title="Join a league" />
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator color="#7142FF" />
          <Text className="text-sm text-white/60">Joining league…</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-ink">
      <ScreenHeader title="Join a league" />
      <View className="gap-4 p-5">
        <Text className="text-base leading-6 text-white/70">
          Paste the invite link a friend sent you.
        </Text>
        <TextInput
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://moviedrafter.com/league/join?token=…"
          placeholderTextColor="#BDC3C2"
          className="rounded-sm border border-white/30 bg-card px-4 py-3 text-base text-white"
        />
        {error && <Text className="text-sm text-red-400">{error}</Text>}
        <Button
          label="Join league"
          onPress={() => join(input)}
          disabled={!input.trim()}
          loading={joining}
        />
      </View>
    </View>
  );
}
