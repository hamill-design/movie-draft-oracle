import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, TextInput, View } from "react-native";
import { formatDistanceToNow } from "date-fns";
import { Image } from "expo-image";
import { ChevronDown, ChevronUp, MessageSquare, Send, Trash2 } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useLeagueMessages, type LeagueMessage } from "../../hooks/useLeagues";
import { colors } from "../../lib/theme";
import { Text, initialsOf } from "../ui";

const SHELL = {
  borderRadius: 4,
  padding: 16,
  gap: 12,
  backgroundColor: "rgba(255,255,255,0.05)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.1)",
  boxShadow: "0px 0px 4px rgba(113,66,255,0.15)",
} as const;

function Avatar({ msg, size }: { msg: LeagueMessage; size: number }) {
  const url = msg.author?.avatar_url;
  return url ? (
    <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#3B0394", alignItems: "center", justifyContent: "center" }}>
      <Text className="font-brockmann-semibold" style={{ fontSize: size * 0.375 }}>
        {initialsOf(msg.author?.name ?? "")}
      </Text>
    </View>
  );
}

function ReplyInput({ onSend, value, onChange }: { onSend: () => void; value: string; onChange: (v: string) => void }) {
  return (
    <View className="flex-row items-center gap-2 pt-2">
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Write a reply…"
        placeholderTextColor="#9EA3A1"
        multiline
        style={{
          flex: 1,
          minHeight: 32,
          maxHeight: 96,
          borderRadius: 2,
          backgroundColor: "rgba(255,255,255,0.05)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.15)",
          color: "#FAFEFF",
          fontFamily: "Brockmann-Regular",
          fontSize: 12,
          paddingHorizontal: 10,
          paddingVertical: 6,
        }}
      />
      <Pressable
        onPress={onSend}
        disabled={!value.trim()}
        className="h-8 items-center justify-center rounded-control px-3"
        style={{ backgroundColor: "#640AFF", opacity: value.trim() ? 1 : 0.5 }}
      >
        <Send size={14} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

function Post({
  msg,
  replies,
  currentUserId,
  isAdmin,
  onDelete,
  onReply,
}: {
  msg: LeagueMessage;
  replies: LeagueMessage[];
  currentUserId?: string;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  onReply: (parentId: string, content: string) => Promise<boolean>;
}) {
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState("");
  const canDelete = (m: LeagueMessage) => m.user_id === currentUserId || isAdmin;

  const send = async () => {
    if (!replyText.trim()) return;
    const ok = await onReply(msg.id, replyText);
    if (ok) {
      setReplyText("");
      setShowReplies(true);
    } else Alert.alert("Could not post reply.");
  };

  return (
    <View style={SHELL}>
      <View className="flex-row gap-3">
        <Avatar msg={msg} size={32} />
        <View className="flex-1">
          <View className="flex-row flex-wrap items-baseline gap-2">
            <Text className="font-brockmann-semibold text-sm text-[#FAFEFF]">{msg.author?.name ?? "Unknown"}</Text>
            <Text className="text-xs text-[#9EA3A1]">{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}</Text>
          </View>
          <Text className="mt-1 text-sm text-[#D6DBDB]">{msg.content}</Text>
        </View>
        {canDelete(msg) && (
          <Pressable onPress={() => onDelete(msg.id)} hitSlop={8} accessibilityLabel="Delete post" className="self-start">
            <Trash2 size={16} color="#9EA3A1" />
          </Pressable>
        )}
      </View>

      <View style={{ paddingLeft: 44 }}>
        <Pressable onPress={() => setShowReplies((v) => !v)} className="flex-row items-center gap-1.5">
          <MessageSquare size={14} color="#9EA3A1" />
          <Text className="text-xs text-[#9EA3A1]">
            {replies.length > 0 ? `${replies.length} ${replies.length === 1 ? "reply" : "replies"}` : "Reply"}
          </Text>
          {replies.length > 0 && (showReplies ? <ChevronUp size={12} color="#9EA3A1" /> : <ChevronDown size={12} color="#9EA3A1" />)}
        </Pressable>

        <View style={{ marginTop: 12, borderLeftWidth: showReplies || replyText ? 1 : 0, borderLeftColor: "rgba(255,255,255,0.1)", paddingLeft: showReplies || replyText ? 12 : 0 }}>
          {showReplies &&
            replies.map((r) => (
              <View key={r.id} className="flex-row gap-3 py-2">
                <Avatar msg={r} size={24} />
                <View className="flex-1">
                  <View className="flex-row flex-wrap items-baseline gap-2">
                    <Text className="font-brockmann-semibold text-xs text-[#FAFEFF]">{r.author?.name ?? "Unknown"}</Text>
                    <Text className="text-[10px] text-[#9EA3A1]">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</Text>
                  </View>
                  <Text className="mt-0.5 text-xs text-[#D6DBDB]">{r.content}</Text>
                </View>
                {canDelete(r) && (
                  <Pressable onPress={() => onDelete(r.id)} hitSlop={8} accessibilityLabel="Delete reply" className="self-start">
                    <Trash2 size={12} color="#9EA3A1" />
                  </Pressable>
                )}
              </View>
            ))}
          <ReplyInput value={replyText} onChange={setReplyText} onSend={send} />
        </View>
      </View>
    </View>
  );
}

// Port of the website's LeagueMessageBoard (dashboard layout, max 768).
export function LeagueMessageBoard({ leagueId, isAdmin }: { leagueId: string; isAdmin: boolean }) {
  const { user } = useAuth();
  const { posts, repliesMap, loading, sendMessage, deleteMessage } = useLeagueMessages(leagueId);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    if (!newPost.trim()) return;
    setPosting(true);
    const ok = await sendMessage(newPost);
    setPosting(false);
    if (ok) setNewPost("");
    else Alert.alert("Could not post message.");
  };

  const confirmDelete = (id: string) =>
    Alert.alert("Delete message?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMessage(id) },
    ]);

  if (loading) {
    return (
      <View className="items-center py-8">
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={{ gap: 16, width: "100%", maxWidth: 768, alignSelf: "center" }}>
      <View style={SHELL}>
        <TextInput
          value={newPost}
          onChangeText={setNewPost}
          placeholder="Post something to the league…"
          placeholderTextColor="#9EA3A1"
          multiline
          style={{
            minHeight: 72,
            borderRadius: 2,
            backgroundColor: "rgba(255,255,255,0.05)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.15)",
            color: "#FAFEFF",
            fontFamily: "Brockmann-Regular",
            fontSize: 14,
            padding: 12,
            textAlignVertical: "top",
          }}
        />
        <View className="flex-row justify-end">
          <Pressable
            onPress={handlePost}
            disabled={!newPost.trim() || posting}
            className="flex-row items-center gap-2 rounded-control px-4 py-2"
            style={{ backgroundColor: "#640AFF", opacity: !newPost.trim() || posting ? 0.5 : 1 }}
          >
            <Send size={14} color="#FFFFFF" />
            <Text className="font-brockmann-medium text-sm text-white">{posting ? "Posting…" : "Post"}</Text>
          </Pressable>
        </View>
      </View>

      {posts.length === 0 ? (
        <View className="items-center gap-2 py-12">
          <MessageSquare size={32} color="#9EA3A1" />
          <Text className="text-sm text-greyscale-blue-300">No posts yet.</Text>
          <Text className="text-xs text-greyscale-blue-400">Be the first to say something.</Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {posts.map((post) => (
            <Post
              key={post.id}
              msg={post}
              replies={repliesMap[post.id] ?? []}
              currentUserId={user?.id}
              isAdmin={isAdmin}
              onDelete={confirmDelete}
              onReply={(parentId, content) => sendMessage(content, parentId)}
            />
          ))}
        </View>
      )}
    </View>
  );
}
