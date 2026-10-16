import { useEffect, useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { User } from "lucide-react-native";
import { searchPeople } from "../lib/draftSetup";
import { initialsOf, Text } from "./ui";

const SIZES = { sm: 32, md: 48, lg: 96 } as const;
const TMDB = "https://image.tmdb.org/t/p/";

// TMDB profile photo in a circle; falls back to initials (web ActorPortrait).
export function ActorPortrait({
  profilePath,
  name,
  size = "md",
  px,
  square = false,
}: {
  profilePath: string | null;
  name: string;
  size?: keyof typeof SIZES;
  px?: number;
  square?: boolean;
}) {
  const dim = px ?? SIZES[size];
  const radius = square ? 4 : dim / 2;
  if (profilePath) {
    return (
      <Image
        source={{ uri: `${TMDB}${size === "sm" ? "w185" : "w500"}${profilePath}` }}
        style={{ width: dim, height: dim, borderRadius: radius }}
        contentFit="cover"
      />
    );
  }
  return (
    <View style={{ width: dim, height: dim, borderRadius: radius, backgroundColor: "#2C2B2D", alignItems: "center", justifyContent: "center" }}>
      {name ? (
        <Text className="font-brockmann-semibold" style={{ fontSize: dim * 0.375 }}>
          {initialsOf(name)}
        </Text>
      ) : (
        <User size={dim * 0.4} color="#9E9CA3" />
      )}
    </View>
  );
}

const portraitCache = new Map<string, string | null>();

// Looks the person up by name (TMDB search) and shows their portrait (web DraftActorPortrait).
export function DraftActorPortrait({ actorName, size = "md", px, square }: { actorName: string; size?: keyof typeof SIZES; px?: number; square?: boolean }) {
  const clean = actorName.includes("|") ? actorName.split("|")[0] : actorName;
  const [path, setPath] = useState<string | null | undefined>(portraitCache.get(clean.toLowerCase()));

  useEffect(() => {
    const key = clean.toLowerCase();
    if (!clean || portraitCache.has(key)) {
      setPath(portraitCache.get(key) ?? null);
      return;
    }
    let cancelled = false;
    searchPeople(clean)
      .then((people) => {
        const match = people.find((p) => p.name.toLowerCase() === key);
        portraitCache.set(key, match?.profile_path ?? null);
        if (!cancelled) setPath(match?.profile_path ?? null);
      })
      .catch(() => !cancelled && setPath(null));
    return () => {
      cancelled = true;
    };
  }, [clean]);

  return <ActorPortrait profilePath={path ?? null} name={clean} size={size} px={px} square={square} />;
}
