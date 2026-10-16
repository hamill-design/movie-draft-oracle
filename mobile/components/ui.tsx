import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Top bar used by every screen below the leagues list: back arrow, title, and
// an optional action on the right.
export function ScreenHeader({
  title,
  right,
  backHref,
}: {
  title: string;
  right?: ReactNode;
  backHref?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace((backHref ?? "/leagues") as never);
  };
  return (
    <View style={{ paddingTop: insets.top }} className="bg-ink">
      <View className="flex-row items-center justify-between px-5 pb-3 pt-3">
        <Pressable onPress={goBack} hitSlop={12} className="w-16 active:opacity-70">
          <Text className="text-base text-white/70">‹ Back</Text>
        </Pressable>
        <Text numberOfLines={1} className="flex-1 text-center text-base font-semibold text-white">
          {title}
        </Text>
        <View className="w-16 items-end">{right}</View>
      </View>
    </View>
  );
}

// "gold" = the main call to action (matches the yellow buttons on the web),
// "outline" = secondary action.
export function Button({
  label,
  onPress,
  disabled,
  loading,
  variant = "gold",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "gold" | "outline" | "brand";
}) {
  const inactive = disabled || loading;
  const base = "min-h-[48px] items-center justify-center rounded-sm px-6 py-3";
  const style =
    variant === "gold"
      ? "bg-gold"
      : variant === "brand"
        ? "bg-brand"
        : "border border-white/25 bg-card";
  const text =
    variant === "gold" ? "text-[#2B2D2D]" : "text-white";
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      className={`${base} ${style} ${inactive ? "opacity-50" : "active:opacity-80"}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === "gold" ? "#2B2D2D" : "#fff"} />
      ) : (
        <Text className={`text-base font-semibold ${text}`}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View className="rounded-lg bg-surface p-5">{children}</View>;
}

export function Centered({ children }: { children: ReactNode }) {
  return <View className="flex-1 items-center justify-center bg-ink px-6">{children}</View>;
}
