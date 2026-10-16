import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { Mail, Tag, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useLeagueActions } from "../../hooks/useLeagues";
import { supabase } from "../../lib/supabase";
import { colors } from "../../lib/theme";
import { LeagueTrophy } from "../../components/brand";
import { AppHeader, Button, Field, GlowCard, SectionHeader, Text } from "../../components/ui";

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
      Alert.alert("Something went wrong", "Could not create league. Try again.");
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
        Alert.alert("League created", "Invites could not be sent. Add them from league settings.");
      }
    }

    setSubmitting(false);
    router.replace(`/league/${league.id}`);
  };

  return (
    <View className="flex-1">
      <AppHeader backHref="/leagues" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 48, gap: 24 }}
        >
          {/* Hero */}
          <View className="items-center gap-6 py-6">
            <LeagueTrophy width={124} />
            <View className="gap-4">
              <Text className="text-center font-chaney" style={{ fontSize: 44, lineHeight: 50, letterSpacing: 1 }}>
                CREATE A LEAGUE
              </Text>
              <Text className="text-center font-brockmann-medium text-xl leading-7">
                Take your movie competitions to the next level. Compete with friends across multiple drafts. You'll
                be the league admin and can invite members after setup.
              </Text>
            </View>
          </View>

          <GlowCard>
            <SectionHeader icon={<Tag size={20} color={colors.accent} />} title="League Name" />
            <Field
              value={name}
              onChangeText={setName}
              maxLength={60}
              autoFocus
              strokeColor={colors.textPrimary}
              placeholder="e.g. The Cinephiles, Friday Night Drafts"
            />
          </GlowCard>

          <GlowCard>
            <SectionHeader icon={<Mail size={20} color={colors.accent} />} title="Invite Members" />
            <View className="flex-row items-stretch gap-2">
              <View className="flex-1">
                <Field
                  value={emailInput}
                  onChangeText={setEmailInput}
                  onSubmitEditing={addEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  strokeColor={colors.textGrey}
                  placeholder="Enter email address of players you want to add"
                />
              </View>
              <Pressable
                onPress={addEmail}
                className="justify-center rounded-control bg-brand px-3 active:opacity-80"
              >
                <Text className="font-brockmann-medium text-sm">Add</Text>
              </Pressable>
            </View>

            <View className="gap-3">
              <Text className="text-base leading-6 text-greyscale-blue-600">Participants ({emails.length}):</Text>
              <View className="flex-row flex-wrap gap-2">
                {emails.map((email) => (
                  <View
                    key={email}
                    className="flex-row items-center gap-2 rounded bg-brand"
                    style={{ paddingVertical: 8, paddingLeft: 16, paddingRight: 10 }}
                  >
                    <Text className="shrink font-brockmann-medium text-sm leading-5">{email}</Text>
                    <Pressable
                      onPress={() => setEmails((prev) => prev.filter((x) => x !== email))}
                      hitSlop={8}
                      accessibilityLabel={`Remove ${email}`}
                    >
                      <X size={16} color={colors.textPrimary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          </GlowCard>

          <Button
            label={submitting ? "Creating…" : "Create League"}
            inline
            disabled={!name.trim() || submitting}
            onPress={submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
