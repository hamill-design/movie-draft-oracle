import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { VotingPanel } from "../../components/VotingPanel";
import { Button, Centered, ScreenHeader } from "../../components/ui";

// Where a shared voting link lands (moviedrafter.com/vote/:id or moviedrafter://vote/:id).
export default function VoteScreen() {
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, loading } = useAuth();

  if (!loading && !session) {
    return (
      <View className="flex-1 bg-ink">
        <ScreenHeader title="Vote" />
        <Centered>
          <Text className="mb-4 text-center text-base text-white/70">Sign in to cast your vote.</Text>
          <Button label="Sign in" onPress={() => router.replace("/login")} />
        </Centered>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-ink">
      <ScreenHeader title="Vote" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 16 }}>
        <VotingPanel draftId={draftId} />
        <Button label="See final scores" variant="outline" onPress={() => router.push(`/final-scores/${draftId}`)} />
      </ScrollView>
    </View>
  );
}
