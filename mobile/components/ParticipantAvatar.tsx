import { View } from "react-native";
import { Image } from "expo-image";
import { Text, initialsOf } from "./ui";

// Avatar with the website's online dot (green, bottom-right) and an optional "on the clock" ring.
export function ParticipantAvatar({
  name,
  avatarUrl,
  size = 32,
  online = false,
  ring = false,
  fontSize,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  online?: boolean;
  ring?: boolean;
  fontSize?: number;
}) {
  const dot = Math.max(10, Math.round(size * 0.19));
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#1A1D29",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          borderWidth: ring ? 2 : 0,
          borderColor: "#7142FF",
        }}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: size, height: size }} contentFit="cover" />
        ) : (
          <Text className="font-brockmann-semibold" style={{ fontSize: fontSize ?? Math.round(size * 0.28) }}>
            {initialsOf(name)}
          </Text>
        )}
      </View>
      {online && (
        <View
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: "#41DA86",
            borderWidth: 2,
            borderColor: "#0E0E0F",
          }}
        />
      )}
    </View>
  );
}
