import { useCallback, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ChevronRight, Plus } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useLeagueActions, usePendingLeagueInvites, useUserLeagues } from "../hooks/useLeagues";
import { colors } from "../lib/theme";
import { LeagueTrophy } from "../components/brand";
import { AppHeader, Button, GlowCard, Text } from "../components/ui";

// Layout follows the website's Profile page: a "League Invites" card (only when there are
// invites) and a "My Leagues" card. Join / Start a draft / Sign out are phone-only extras.
export default function Leagues() {
  const { signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { leagues, loading, refetch } = useUserLeagues();
  const { invites, refetch: refetchInvites } = usePendingLeagueInvites();
  const { acceptInvite, declineInvite } = useLeagueActions();
  const [refreshing, setRefreshing] = useState(false);
  const [busyInvite, setBusyInvite] = useState<string | null>(null);

  // Refresh whenever we come back to this screen (e.g. after creating or joining a league).
  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchInvites();
    }, [refetch, refetchInvites]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchInvites()]);
    setRefreshing(false);
  };

  const accept = async (inviteId: string) => {
    setBusyInvite(inviteId);
    const leagueId = await acceptInvite(inviteId);
    setBusyInvite(null);
    if (leagueId) router.push(`/league/${leagueId}`);
    else Alert.alert("Could not accept invite", "Something went wrong. Please try again.");
  };

  const decline = async (inviteId: string) => {
    setBusyInvite(inviteId);
    const ok = await declineInvite(inviteId);
    setBusyInvite(null);
    if (ok) await refetchInvites();
    else Alert.alert("Could not decline invite", "Something went wrong. Please try again.");
  };

  return (
    <View className="flex-1">
      <AppHeader
        showBack={false}
        right={
          <Pressable onPress={signOut} hitSlop={10} className="active:opacity-70">
            <Text className="text-sm text-greyscale-blue-300">Sign out</Text>
          </Pressable>
        }
      />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 24 }}
      >
        {/* Hero */}
        <View className="items-center gap-3 pt-2">
          <LeagueTrophy width={96} />
          <Text className="font-chaney" style={{ fontSize: 40, lineHeight: 44 }}>
            LEAGUES
          </Text>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button label="Start a draft" onPress={() => router.push("/draft/new")} />
          </View>
          <View className="flex-1">
            <Button label="Join league" variant="outline" onPress={() => router.push("/league/join")} />
          </View>
        </View>

        {/* League Invites */}
        {invites.length > 0 && (
          <GlowCard gap={16}>
            <Text className="font-brockmann-medium text-xl leading-7">League Invites</Text>
            {invites.map((invite) => (
              <View
                key={invite.id}
                className="gap-3 rounded-tile bg-card px-4 py-3"
                style={{ borderWidth: 1, borderColor: "#2E2C32" }}
              >
                <View>
                  <Text className="text-sm leading-5">{invite.league?.name ?? "A league"}</Text>
                  <Text className="text-xs leading-4 text-greyscale-blue-300" style={{ letterSpacing: 0.36 }}>
                    Invited by {invite.inviter?.name ?? "Someone"}
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Button label="Accept" variant="brand" small disabled={busyInvite === invite.id} onPress={() => accept(invite.id)} />
                  </View>
                  <View className="flex-1">
                    <Button label="Decline" variant="outline" small disabled={busyInvite === invite.id} onPress={() => decline(invite.id)} />
                  </View>
                </View>
              </View>
            ))}
          </GlowCard>
        )}

        {/* My Leagues */}
        <GlowCard>
          <View className="flex-row items-center justify-between gap-3">
            <Text className="font-brockmann-medium text-xl leading-7">My Leagues</Text>
            <Button
              label="Create League"
              variant="brand"
              small
              inline
              icon={<Plus size={16} color={colors.textPrimary} />}
              onPress={() => router.push("/league/create")}
            />
          </View>

          {loading && leagues.length === 0 ? (
            <Text className="text-sm">Loading leagues…</Text>
          ) : leagues.length === 0 ? (
            <Text className="text-sm leading-5 text-greyscale-blue-300">
              No leagues yet. Create one to compete with friends across multiple drafts.
            </Text>
          ) : (
            <View style={{ gap: 12 }}>
              {leagues.map((league) => (
                <Pressable
                  key={league.id}
                  onPress={() => router.push(`/league/${league.id}`)}
                  className="flex-row items-center rounded-card bg-card active:opacity-80"
                  style={{ borderWidth: 1, borderColor: colors.itemStroke, paddingVertical: 16, paddingLeft: 18, paddingRight: 6 }}
                >
                  <View className="flex-1">
                    <Text className="font-brockmann-medium text-lg leading-[26px]">{league.name}</Text>
                    <Text className="text-sm leading-5 text-greyscale-blue-300">
                      <Text className="font-brockmann-bold text-sm">{league.member_count ?? 0}</Text> members |{" "}
                      <Text className="font-brockmann-bold text-sm">{league.draft_count ?? 0}</Text> drafts
                    </Text>
                  </View>
                  <View className="p-3">
                    <ChevronRight size={24} color={colors.textPrimary} />
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </GlowCard>
      </ScrollView>
    </View>
  );
}
