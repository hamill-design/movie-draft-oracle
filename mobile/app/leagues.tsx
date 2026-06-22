import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

type League = {
  id: string;
  name: string;
  slug: string;
  member_count: number;
  draft_count: number;
};

export default function Leagues() {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);

  // Mirrors useUserLeagues() in the web app: the leagues the signed-in user is
  // a member of, with member + draft counts.
  const fetchLeagues = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("league_members")
      .select(
        `league_id, joined_at,
         leagues ( id, name, slug, admin_id, created_at, updated_at,
                   league_members (count), league_drafts (count) )`
      )
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false });

    if (!error && data) {
      const mapped = data
        .map((row: any) => {
          const L = row.leagues;
          if (!L) return null;
          return {
            id: L.id,
            name: L.name,
            slug: L.slug,
            member_count: Number(L.league_members?.[0]?.count ?? 0),
            draft_count: Number(L.league_drafts?.[0]?.count ?? 0),
          } as League;
        })
        .filter(Boolean) as League[];
      setLeagues(mapped);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchLeagues();
  }, [fetchLeagues]);

  return (
    <View className="flex-1 bg-ink" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-6 pb-4 pt-4">
        <Text className="text-2xl font-bold text-white">Your leagues</Text>
        <Pressable onPress={signOut} className="active:opacity-70">
          <Text className="text-sm text-white/60">Sign out</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#680AFF" />
        </View>
      ) : (
        <FlatList
          data={leagues}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 24, paddingTop: 0 }}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchLeagues}
              tintColor="#680AFF"
            />
          }
          ListEmptyComponent={
            <Text className="mt-10 text-center text-base text-white/50">
              You're not in any leagues yet.
            </Text>
          }
          renderItem={({ item }) => (
            <View className="mb-3 rounded-2xl bg-white/5 p-5">
              <Text className="text-lg font-semibold text-white">{item.name}</Text>
              <Text className="mt-1 text-sm text-white/50">
                {item.member_count}{" "}
                {item.member_count === 1 ? "member" : "members"} · {item.draft_count}{" "}
                {item.draft_count === 1 ? "draft" : "drafts"}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
