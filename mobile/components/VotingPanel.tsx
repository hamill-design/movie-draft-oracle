import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { Check, Copy } from "lucide-react-native";
import { VOTING_DURATIONS, formatCountdown, useDraftVoting } from "../hooks/useDraftVoting";
import { MONO, colors } from "../lib/theme";
import { Button, GlowCard, Text } from "./ui";

const SITE = "https://moviedrafter.com";

// Voting cards share the website's VotingSessionCard shell: glow card, max 617 wide, centred.
function SessionCard({ children }: { children: React.ReactNode }) {
  return (
    <GlowCard style={{ width: "100%", maxWidth: 617, alignSelf: "center", alignItems: "stretch" }}>{children}</GlowCard>
  );
}

const Title = ({ children }: { children: string }) => (
  <Text className="text-center font-brockmann-bold text-2xl leading-8" style={{ letterSpacing: 0.96 }}>
    {children}
  </Text>
);

// Yes/No (or any choice) button: brand when active, #1D1D1F + #49474B stroke otherwise.
function Choice({ label, active, disabled, onPress }: { label: string; active: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="flex-1 items-center justify-center rounded"
      style={{
        minHeight: 44,
        paddingHorizontal: 12,
        backgroundColor: active ? colors.brand : colors.uiPrimary,
        borderWidth: active ? 0 : 1,
        borderColor: colors.itemStroke,
        opacity: disabled && !active ? 0.5 : 1,
      }}
    >
      <Text className="font-brockmann-medium text-sm leading-5">{label}</Text>
    </Pressable>
  );
}

function CopyPill({ text, value }: { text: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <View className="flex-row items-center justify-center" style={{ gap: 8 }}>
      <View className="shrink rounded-full bg-card" style={{ paddingHorizontal: 14, paddingVertical: 4, borderWidth: 1, borderColor: colors.textPrimary }}>
        <Text numberOfLines={1} className="text-base" style={{ fontFamily: MONO, letterSpacing: 0.5 }}>
          {text}
        </Text>
      </View>
      <Pressable
        onPress={async () => {
          await Clipboard.setStringAsync(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="flex-row items-center gap-2 rounded-control bg-card"
        style={{ paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.textPrimary }}
      >
        <Text className="font-brockmann-medium text-sm">{copied ? "Copied!" : "Copy"}</Text>
        {copied ? <Check size={16} color={colors.textPrimary} /> : <Copy size={16} color={colors.textPrimary} />}
      </Pressable>
    </View>
  );
}

// Everything voting-related for one finished multiplayer draft (web VotingSetupWizard, CastVotePanel,
// PublicVoteShareCard). Renders nothing for incomplete / non-multiplayer drafts, or (with `hideWhenIdle`)
// when there's nothing for this person to do.
export function VotingPanel({ draftId, hideWhenIdle = false }: { draftId: string; hideWhenIdle?: boolean }) {
  const v = useDraftVoting(draftId);
  const [addVoting, setAddVoting] = useState<boolean | null>(null);
  const [isPublic, setIsPublic] = useState<boolean | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (v.loading) {
    return (
      <SessionCard>
        <ActivityIndicator color={colors.brand} />
      </SessionCard>
    );
  }
  if (!v.meta?.is_complete || !v.meta.is_multiplayer) return null;

  const voteUrl = `${SITE}/vote/${draftId}`;
  const totalVotes = [...v.counts.values()].reduce((a, b) => a + b, 0);

  const results = (
    <View style={{ gap: 12 }}>
      {v.participants.map((p) => {
        const count = v.counts.get(p.id) ?? 0;
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        return (
          <View key={p.id} style={{ gap: 8 }}>
            <View className="flex-row items-center justify-between" style={{ gap: 8 }}>
              <Text numberOfLines={1} className="flex-1 text-xs leading-4">
                {p.participant_name}
              </Text>
              <Text className="font-brockmann-semibold text-xs leading-4">{pct}%</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: "#2C2B2D", overflow: "hidden" }}>
              <View style={{ height: 8, width: `${pct}%`, backgroundColor: colors.brand, borderRadius: 4 }} />
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

  // ── Host setup (progressive: Enable → Public → Time → Begin) ──
  if (!v.configured) {
    if (!v.isHost) {
      if (hideWhenIdle) return null;
      return (
        <SessionCard>
          <Text className="text-center text-sm text-greyscale-blue-300">Waiting for host to set up voting...</Text>
        </SessionCard>
      );
    }
    return (
      <SessionCard>
        <Title>Enable Voting?</Title>
        <View className="flex-row" style={{ gap: 16 }}>
          <Choice label="Yes" active={addVoting === true} disabled={addVoting === false} onPress={() => setAddVoting(true)} />
          <Choice label="No" active={addVoting === false} disabled={addVoting === true} onPress={() => setAddVoting(false)} />
        </View>

        {addVoting === true && (
          <>
            <Title>Gather Public Votes?</Title>
            <View className="flex-row" style={{ gap: 16 }}>
              <Choice label="Yes" active={isPublic === true} onPress={() => setIsPublic(true)} />
              <Choice label="No" active={isPublic === false} onPress={() => setIsPublic(false)} />
            </View>
            {isPublic === true && <CopyPill text={`moviedrafter.com/vote/${draftId.slice(0, 8)}…`} value={voteUrl} />}
          </>
        )}

        {addVoting === true && isPublic !== null && (
          <>
            <Title>Set A Time Limit</Title>
            <View className="flex-row" style={{ gap: 16 }}>
              {VOTING_DURATIONS.map((d) => (
                <Choice key={d.value} label={d.label} active={minutes === d.value} onPress={() => setMinutes(d.value)} />
              ))}
            </View>
            <Button
              label={busy ? "Enabling…" : "Begin Voting"}
              variant="brand"
              inline
              disabled={busy || minutes == null}
              onPress={() => run(() => v.enableVoting(isPublic === true, minutes!), "Could not start voting")}
            />
          </>
        )}
      </SessionCard>
    );
  }

  // ── Closed ──
  if (!v.open) {
    if (hideWhenIdle) return null;
    return (
      <SessionCard>
        <Text className="text-center text-sm text-greyscale-blue-300">Voting closed</Text>
        {results}
      </SessionCard>
    );
  }

  // ── Open ──
  const candidates = v.participants.filter((p) => p.id !== v.me?.id);
  const countdown =
    v.endsAt != null ? (
      <Text className="text-center text-sm">
        Voting ends in <Text className="font-brockmann-semibold text-sm">{formatCountdown(v.remainingMs)}</Text>
      </Text>
    ) : null;

  return (
    <View style={{ gap: 16 }}>
      {v.isHost && v.meta.allow_public_voting && (
        <SessionCard>
          <Text className="text-center font-brockmann-medium text-xl leading-7">Voting is Open</Text>
          <Text className="text-center text-sm leading-5">
            Other participants will see the voting option on this page. Share the link or scan the QR code below so anyone can vote.
          </Text>
          <CopyPill text={`moviedrafter.com/vote/${draftId.slice(0, 8)}…`} value={voteUrl} />
          <View className="items-center">
            <View className="rounded-lg bg-white p-3">
              <QRCode value={voteUrl} size={120} />
            </View>
          </View>
        </SessionCard>
      )}

      <SessionCard>
        {countdown}
        {v.me?.is_ai ? (
          <Text className="text-center text-sm">AI players cannot vote.</Text>
        ) : v.myVote ? (
          <>
            <Text className="text-center font-brockmann-medium text-xl leading-7">
              You Voted For {v.participants.find((p) => p.id === v.myVote?.voted_participant_id)?.participant_name ?? "Unknown"}
            </Text>
            {results}
          </>
        ) : (
          <>
            <Text className="text-center font-brockmann-medium text-xl leading-7">Cast Your Vote For Who Won</Text>
            <View style={{ gap: 16 }}>
              {candidates.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => setSelected((cur) => (cur === p.id ? null : p.id))}
                  className="items-center justify-center rounded"
                  style={{
                    minHeight: 44,
                    paddingHorizontal: 24,
                    backgroundColor: selected === p.id ? colors.brand : colors.uiPrimary,
                    borderWidth: selected === p.id ? 0 : 1,
                    borderColor: colors.itemStroke,
                  }}
                >
                  <Text numberOfLines={1} className="font-brockmann-medium text-sm leading-5">
                    {p.participant_name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Button
              label="Confirm Choice"
              inline
              loading={busy}
              disabled={!selected}
              onPress={async () => {
                if (!selected) return;
                if (await run(() => v.vote(selected), "Could not vote")) setSelected(null);
              }}
            />
            {totalVotes > 0 && (
              <Text className="text-center text-xs" style={{ opacity: 0.8 }}>
                {v.participants
                  .filter((p) => v.counts.has(p.id))
                  .map((p) => `${p.participant_name}: ${v.counts.get(p.id)}`)
                  .join(" · ")}
              </Text>
            )}
          </>
        )}
      </SessionCard>
    </View>
  );
}
