import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { usePendingLeagueInvites, useUserLeagues } from "../hooks/useLeagues";
import { Button } from "../components/ui";

export default function Leagues() {
  const { signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { leagues, loading, refetch } = useUserLeagues();
  const { invites, refetch: refetchInvites } = usePendingLeagueInvites();
  const [refreshing, setRefreshing] = useState(false);

  // Refresh whenever we come back to this screen (e.g. after creating or
  // joining a league) so the new league shows up without a manual pull.
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

  return (
    <View className="flex-1 bg-ink" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-6 pb-4 pt-4">
        <Text className="text-2xl font-bold text-white">Your leagues</Text>
        <Pressable onPress={signOut} className="active:opacity-70">
          <Text className="text-sm text-white/60">Sign out</Text>
        </Pressable>
      </View>

      {loading && leagues.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7142FF" />
        </View>
      ) : (
        <FlatList
          data={leagues}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 24, paddingTop: 0, paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7142FF" />
          }
          ListHeaderComponent={
            <View>
              <View className="mb-4 flex-row gap-3">
                <View className="flex-1">
                  <Button label="Create league" onPress={() => router.push("/league/create")} />
                </View>
                <View className="flex-1">
                  <Button
                    label="Join league"
                    variant="outline"
                    onPress={() => router.push("/league/join")}
                  />
                </View>
              </View>

              {invites.map((invite) => (
                <Pressable
                  key={invite.id}
                  onPress={() => router.push(`/league/${invite.league_id}`)}
                  className="mb-3 rounded-lg border-l-4 border-brand bg-surface p-5 active:opacity-80"
                >
                  <Text className="text-xs font-semibold uppercase tracking-widest text-accent">
                    League invite
                  </Text>
                  <Text className="mt-1 text-lg font-semibold text-white">
                    {invite.league?.name ?? "A league"}
                  </Text>
                  <Text className="mt-1 text-sm text-white/50">
                    {invite.inviter?.name ?? "Someone"} invited you · tap to respond
                  </Text>
                </Pressable>
              ))}
            </View>
          }
          ListEmptyComponent={
            <Text className="mt-10 text-center text-base text-white/50">
              You're not in any leagues yet. Create one or join with an invite.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/league/${item.id}`)}
              className="mb-3 rounded-2xl bg-white/5 p-5 active:opacity-80"
            >
              <Text className="text-lg font-semibold text-white">{item.name}</Text>
              <Text className="mt-1 text-sm text-white/50">
                {item.member_count} {item.member_count === 1 ? "member" : "members"} ·{" "}
                {item.draft_count} {item.draft_count === 1 ? "draft" : "drafts"}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
