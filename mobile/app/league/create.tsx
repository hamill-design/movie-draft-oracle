import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useLeagueActions } from "../../hooks/useLeagues";
import { supabase } from "../../lib/supabase";
import { Button, Card, ScreenHeader } from "../../components/ui";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same edge function the website calls after creating a league.
async function sendInvitesForLeague(
  leagueId: string,
  leagueName: string,
  adminName: string,
  emails: string[],
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-league-invitations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ leagueId, leagueName, adminName, emails }),
    },
  );
  const result = await res.json();
  if (!result.success) throw new Error(result.error ?? "Invite send failed");
}

export default function CreateLeague() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { createLeague } = useLeagueActions();
  const [name, setName] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (!email || !EMAIL_REGEX.test(email) || emails.includes(email)) return;
    setEmails((prev) => [...prev, email]);
    setEmailInput("");
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);

    const league = await createLeague(trimmed);
    if (!league) {
      setSubmitting(false);
      Alert.alert("Something went wrong", "Could not create the league. Try again.");
      return;
    }

    if (emails.length > 0) {
      try {
        await sendInvitesForLeague(
          league.id,
          league.name,
          user?.user_metadata?.full_name ?? user?.email ?? "Your friend",
          emails,
        );
      } catch {
        Alert.alert(
          "League created",
          "Invites could not be sent. You can add people from the league later.",
        );
      }
    }

    setSubmitting(false);
    router.replace(`/league/${league.id}`);
  };

  return (
    <View className="flex-1 bg-ink">
      <ScreenHeader title="Create a league" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 16 }}
        >
          <Text className="text-base leading-6 text-white/70">
            Compete with friends across multiple drafts. You'll be the league admin and can invite
            members now or later.
          </Text>

          <Card>
            <Text className="mb-3 text-lg font-medium text-white">League name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              maxLength={60}
              placeholder="e.g. The Cinephiles"
              placeholderTextColor="#BDC3C2"
              className="rounded-sm border border-white/30 bg-card px-4 py-3 text-base text-white"
            />
          </Card>

          <Card>
            <Text className="mb-3 text-lg font-medium text-white">Invite members</Text>
            <View className="flex-row gap-2">
              <TextInput
                value={emailInput}
                onChangeText={setEmailInput}
                onSubmitEditing={addEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Email address"
                placeholderTextColor="#BDC3C2"
                className="flex-1 rounded-sm border border-white/30 bg-card px-4 py-3 text-base text-white"
              />
              <Pressable
                onPress={addEmail}
                className="items-center justify-center rounded-sm bg-brand px-5 active:opacity-80"
              >
                <Text className="text-base font-medium text-white">Add</Text>
              </Pressable>
            </View>

            <Text className="mb-2 mt-4 text-sm text-white/40">
              Participants ({emails.length})
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {emails.map((email) => (
                <Pressable
                  key={email}
                  onPress={() => setEmails((prev) => prev.filter((x) => x !== email))}
                  className="flex-row items-center gap-2 rounded bg-brand py-2 pl-4 pr-3 active:opacity-80"
                >
                  <Text className="text-sm font-medium text-white">{email}</Text>
                  <Text className="text-base text-white">×</Text>
                </Pressable>
              ))}
            </View>
          </Card>

          <Button
            label={submitting ? "Creating…" : "Create league"}
            onPress={submit}
            disabled={!name.trim()}
            loading={submitting}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
