import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Share, Switch, Text, View } from "react-native";
import { useDraftVoting, VOTING_DURATIONS, formatCountdown } from "../hooks/useDraftVoting";
import { Button, Card } from "./ui";

const SITE = "https://moviedrafter.com";

// Everything voting-related for one finished multiplayer draft: host setup,
// casting a vote, live results, and the countdown. Renders nothing for drafts
// that aren't multiplayer/complete, or (when `hideWhenIdle`) when there's
// nothing for this person to do.
export function VotingPanel({ draftId, hideWhenIdle = false }: { draftId: string; hideWhenIdle?: boolean }) {
  const v = useDraftVoting(draftId);
  const [wantVoting, setWantVoting] = useState<boolean | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [minutes, setMinutes] = useState<number>(60);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (v.loading) {
    return (
      <Card>
        <ActivityIndicator color="#7142FF" />
      </Card>
    );
  }
  if (!v.meta?.is_complete || !v.meta.is_multiplayer) return null;

  const totalVotes = [...v.counts.values()].reduce((a, b) => a + b, 0);
  const results = (
    <View className="gap-3">
      {v.participants.map((p) => {
        const count = v.counts.get(p.id) ?? 0;
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        return (
          <View key={p.id} className="gap-1">
            <View className="flex-row justify-between">
              <Text numberOfLines={1} className="flex-1 text-xs text-white">
                {p.participant_name}
              </Text>
              <Text className="text-xs font-semibold text-white">
                {count} · {pct}%
              </Text>
            </View>
            <View className="h-2 overflow-hidden rounded-full bg-[#2C2B2D]">
              <View className="h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} />
            </View>
          </View>
        );
      })}
    </View>
  );

  const run = async (fn: () => Promise<string | null>, failTitle: string) => {
    setBusy(true);
    const err = await fn();
    setBusy(false);
    if (err) Alert.alert(failTitle, err);
    return !err;
  };

  // ── Not set up yet ──
  if (!v.configured) {
    if (!v.isHost) {
      if (hideWhenIdle) return null;
      return (
        <Card>
          <Text className="text-center text-sm text-white/60">Waiting for the host to set up voting…</Text>
        </Card>
      );
    }
    return (
      <Card>
        <Text className="text-center text-xl font-bold text-white">Add a voting round?</Text>
        <Text className="mt-1 text-center text-sm text-white/60">
          Players vote for who they think won. Votes add bonus points to the final scores.
        </Text>
        <View className="mt-4 flex-row gap-3">
          {([true, false] as const).map((yes) => (
            <Pressable
              key={String(yes)}
              onPress={() => setWantVoting(yes)}
              className={`flex-1 items-center rounded-sm py-3 ${wantVoting === yes ? "bg-brand" : "border border-white/25 bg-card"}`}
            >
              <Text className="text-sm font-medium text-white">{yes ? "Yes, add voting" : "No thanks"}</Text>
            </Pressable>
          ))}
        </View>
        {wantVoting === true && (
          <View className="mt-4 gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 pr-3 text-sm text-white/80">Let anyone with the link vote</Text>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ true: "#7142FF", false: "#49474B" }}
              />
            </View>
            <View className="flex-row gap-2">
              {VOTING_DURATIONS.map((d) => (
                <Pressable
                  key={d.value}
                  onPress={() => setMinutes(d.value)}
                  className={`flex-1 items-center rounded-sm py-3 ${minutes === d.value ? "bg-brand" : "border border-white/25 bg-card"}`}
                >
                  <Text className="text-sm font-medium text-white">{d.label}</Text>
                </Pressable>
              ))}
            </View>
            <Button
              label="Begin voting"
              loading={busy}
              onPress={() => run(() => v.enableVoting(isPublic, minutes), "Could not start voting")}
            />
          </View>
        )}
      </Card>
    );
  }

  // ── Closed ──
  if (!v.open) {
    if (hideWhenIdle) return null;
    return (
      <Card>
        <Text className="mb-3 text-center text-lg font-semibold text-white">Voting closed</Text>
        {results}
      </Card>
    );
  }

  // ── Open ──
  const shareLink = () => Share.share({ message: `Vote on who won this Movie Drafter draft: ${SITE}/vote/${draftId}` });
  const candidates = v.participants.filter((p) => p.id !== v.me?.id);

  return (
    <Card>
      {v.endsAt != null && (
        <Text className="mb-3 text-center text-sm text-white/70">
          Voting ends in <Text className="font-semibold text-white">{formatCountdown(v.remainingMs)}</Text>
        </Text>
      )}

      {v.me?.is_ai ? (
        <Text className="text-center text-sm text-white">AI players cannot vote.</Text>
      ) : v.myVote ? (
        <View className="gap-4">
          <Text className="text-center text-xl font-medium text-white">
            You voted for{" "}
            {v.participants.find((p) => p.id === v.myVote?.voted_participant_id)?.participant_name ?? "someone"}
          </Text>
          {results}
        </View>
      ) : (
        <View className="gap-3">
          <Text className="text-center text-xl font-bold text-white">Who won?</Text>
          <Text className="text-center text-sm text-white/60">You can't vote for yourself, and votes are final.</Text>
          {candidates.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setSelected((cur) => (cur === p.id ? null : p.id))}
              className={`rounded-sm px-4 py-3 ${selected === p.id ? "bg-brand" : "border border-white/25 bg-card"}`}
            >
              <Text className="text-base font-medium text-white">{p.participant_name}</Text>
            </Pressable>
          ))}
          <Button
            label="Cast vote"
            disabled={!selected}
            loading={busy}
            onPress={async () => {
              if (!selected) return;
              if (await run(() => v.vote(selected), "Could not vote")) setSelected(null);
            }}
          />
        </View>
      )}

      {v.isHost && v.meta.allow_public_voting && (
        <View className="mt-4">
          <Button label="Share voting link" variant="outline" onPress={shareLink} />
        </View>
      )}
    </Card>
  );
}
