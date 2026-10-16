import { useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { buildBoard } from "../../lib/draftBoard";
import type { DraftParticipant, DraftPickRow, DraftRoom } from "../../hooks/useDraftRoom";
import { DraftBoardTable } from "../../components/DraftBoard";
import { VotingPanel } from "../../components/VotingPanel";
import { AppHeader, Button, GlowCard, PageHero, Text } from "../../components/ui";

const cleanActor = (s: string) => (s.includes("|") ? s.split("|")[0] : s);

// Where a shared voting link lands (moviedrafter.com/vote/:id or moviedrafter://vote/:id):
// completed rosters (scores hidden), then the voting card.
export default function VoteScreen() {
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, loading: authLoading, user } = useAuth();
  const [data, setData] = useState<{ draft: any; picks: DraftPickRow[]; participants: DraftParticipant[]; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId) return;
    (async () => {
      const { data: draft, error: e } = await supabase.from("drafts").select("*").eq("id", draftId).eq("is_complete", true).maybeSingle();
      if (e || !draft || (!draft.allow_public_voting && !session)) {
        setError("This draft is not open for public voting.");
        return;
      }
      const [picksRes, partsRes] = await Promise.all([
        supabase.from("draft_picks").select("*").eq("draft_id", draftId).order("pick_order"),
        supabase.from("draft_participants").select("*").eq("draft_id", draftId).order("created_at", { ascending: true }),
      ]);
      let label = draft.option ?? draft.title ?? "";
      if (draft.theme === "spec-draft") {
        const { data: spec } = await supabase.from("spec_drafts").select("name").eq("id", draft.option).maybeSingle();
        label = spec?.name ?? draft.title ?? "";
      } else label = cleanActor(label);
      setData({ draft, picks: (picksRes.data ?? []) as any, participants: (partsRes.data ?? []) as any, label });
    })();
  }, [draftId, session]);

  const board = useMemo(
    () => (data ? buildBoard(data.draft as DraftRoom, data.participants, data.picks, user?.id) : null),
    [data, user?.id],
  );

  if (!authLoading && !session) {
    return (
      <View className="flex-1">
        <AppHeader backHref="/leagues" showBack={false} />
        <View className="flex-1 items-center justify-center p-4">
          <GlowCard style={{ width: "100%", maxWidth: 420, alignItems: "center" }}>
            <Text className="text-center font-brockmann-medium text-xl leading-7">Sign in to cast your vote.</Text>
            <Button label="Sign in" variant="brand" inline onPress={() => router.replace("/login")} />
          </GlowCard>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <AppHeader backHref="/leagues" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 48, gap: 24 }}>
        {error ? (
          <GlowCard style={{ alignItems: "center" }}>
            <Text className="text-center text-sm text-greyscale-blue-300">{error}</Text>
            <Button label="Back to home" variant="outline" inline onPress={() => router.replace("/leagues")} />
          </GlowCard>
        ) : (
          <>
            {data && <PageHero label="VOTE ON" title={data.label} suffix="MOVIES" size={data.label.length <= 12 ? 36 : 28} />}
            <Text className="text-center text-sm text-greyscale-blue-300">
              Completed rosters – vote for who you think won. Scores are hidden until after voting.
            </Text>
            {board && <DraftBoardTable board={board} />}
            <VotingPanel draftId={draftId} />
            <Button label="See final scores" variant="outline" inline onPress={() => router.push(`/final-scores/${draftId}`)} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
