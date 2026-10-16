import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cardGlow, colors } from "../lib/theme";
import { LogoLong } from "./brand";
import { ArrowLeftIcon } from "./icons";

// ───────────────────────────── Text ─────────────────────────────
// Brockmann is the website's UI font. React Native can't inherit a default font, so
// every Text gets it unless a font-* class is given. Weights are separate families:
// font-brockmann (400), font-brockmann-medium (500), -semibold (600), -bold (700), font-chaney.
export function Text({ className = "", ...props }: TextProps & { className?: string }) {
  const hasFont = /\bfont-(brockmann|chaney)/.test(className);
  return <RNText {...props} className={`text-greyscale-blue-100 ${hasFont ? "" : "font-brockmann"} ${className}`} />;
}

// ───────────────────────────── Header ─────────────────────────────
// Website header: dark #0E0F0F bar with the wordmark. On phone: back arrow, logo, optional right slot.
export function AppHeader({
  onBack,
  right,
  showBack = true,
  backHref,
}: {
  onBack?: () => void;
  right?: ReactNode;
  showBack?: boolean;
  backHref?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const goBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace((backHref ?? "/leagues") as never);
  };
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.sectionContainer }}>
      <View className="flex-row items-center justify-between px-[18px] py-[14px]">
        <View style={{ width: 72, alignItems: "flex-start" }}>
          {showBack && (
            <Pressable onPress={goBack} hitSlop={12} className="active:opacity-70">
              <ArrowLeftIcon size={24} color={colors.textPrimary} />
            </Pressable>
          )}
        </View>
        <LogoLong width={170} color={colors.brand} />
        <View style={{ width: 72, alignItems: "flex-end" }}>{right}</View>
      </View>
    </View>
  );
}

// Older screens call this with a title; the website puts titles in the page hero instead.
export function ScreenHeader({ right, backHref }: { title?: string; right?: ReactNode; backHref?: string }) {
  return <AppHeader right={right} backHref={backHref} />;
}

// ───────────────────────────── Buttons ─────────────────────────────
type ButtonVariant = "gold" | "brand" | "outline" | "ghost" | "link";

// gold = main call to action (#FFD60A on #2B2D2D); brand = #7142FF; outline = #1D1D1F + #666469 stroke.
// `inline` makes it auto-width and centred like the website's CTAs; default fills its container.
export function Button({
  label,
  onPress,
  disabled,
  loading,
  variant = "gold",
  inline = false,
  small = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  inline?: boolean;
  small?: boolean;
  icon?: ReactNode;
}) {
  const inactive = disabled || loading;
  const surface =
    variant === "gold"
      ? "bg-gold"
      : variant === "brand"
        ? "bg-brand"
        : variant === "outline"
          ? "bg-card border border-greyscale-purp-600"
          : "bg-transparent";
  const textColor = variant === "gold" ? "text-greyscale-blue-800" : variant === "link" ? "text-brand" : "text-greyscale-blue-100";
  const size = small ? "px-4 py-2" : variant === "link" || variant === "ghost" ? "px-2 py-2" : "px-6 py-3";
  const textSize = small ? "text-sm" : "text-base";
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={inline ? { alignSelf: "center" } : undefined}
      className={`items-center justify-center rounded-control ${size} ${surface} ${inactive ? "opacity-50" : "active:opacity-80"}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === "gold" ? "#2B2D2D" : "#FCFFFF"} />
      ) : (
        <View className="flex-row items-center justify-center gap-2">
          {icon}
          <Text
            className={`font-brockmann-semibold ${textSize} ${textColor}`}
            style={{ letterSpacing: small ? 0 : 0.32 }}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ───────────────────────────── Cards ─────────────────────────────
// Website section card: #0E0F0F-ish container, 8px radius, 24px padding, violet glow.
export function GlowCard({
  children,
  style,
  gap = 24,
  padding = 24,
  glow = cardGlow,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
  padding?: number;
  glow?: object;
}) {
  return (
    <View style={[{ backgroundColor: colors.sectionContainer, borderRadius: 8, padding, gap }, glow as ViewStyle, style]}>
      {children}
    </View>
  );
}

// Legacy name used by screens that haven't been re-skinned yet.
export function Card({ children }: { children: ReactNode }) {
  return <GlowCard gap={0}>{children}</GlowCard>;
}

// Icon + 20/28 medium title (web HeaderIcon3).
export function SectionHeader({ icon, title, subtitle }: { icon?: ReactNode; title: string; subtitle?: string }) {
  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-2">
        {icon}
        <Text className="flex-1 font-brockmann-medium text-xl leading-7">{title}</Text>
      </View>
      {!!subtitle && <Text className="text-sm text-greyscale-blue-500">{subtitle}</Text>}
    </View>
  );
}

// 24/32 bold, tracking 0.96, uppercase — card titles like "DRAFT BOARD", "FINAL SCORES".
export function SectionTitle({ children, center = false }: { children: string; center?: boolean }) {
  return (
    <Text
      className={`font-brockmann-bold text-2xl leading-8 ${center ? "text-center" : ""}`}
      style={{ letterSpacing: 0.96 }}
    >
      {children.toUpperCase()}
    </Text>
  );
}

export function Centered({ children }: { children: ReactNode }) {
  return <View className="flex-1 items-center justify-center px-6">{children}</View>;
}

// ───────────────────────────── Hero ─────────────────────────────
// Page hero: optional purple-300 label, Chaney title (with an optional purple suffix, e.g. "MOVIES").
export function PageHero({
  label,
  title,
  suffix,
  size = 40,
  color = colors.textPrimary,
  children,
}: {
  label?: string;
  title: string;
  suffix?: string;
  size?: number;
  color?: string;
  children?: ReactNode;
}) {
  return (
    <View className="items-center gap-3 px-1 py-4">
      {!!label && (
        <Text className="font-brockmann-bold text-purple-300" style={{ fontSize: 24, lineHeight: 36, letterSpacing: 1.28 }}>
          {label.toUpperCase()}
        </Text>
      )}
      <Text
        className="text-center font-chaney uppercase"
        style={{ fontSize: size, lineHeight: size * 1.1, color }}
      >
        {title}
        {!!suffix && <Text className="font-chaney uppercase text-purple-300" style={{ fontSize: size }}>{` ${suffix}`}</Text>}
      </Text>
      {children}
    </View>
  );
}

// ───────────────────────────── Forms ─────────────────────────────
// Field: label above, #1D1D1F input with a 1px #666469 stroke and 2px radius.
export function Field({
  label,
  strokeColor = "#666469",
  inputStyle,
  ...props
}: TextInputProps & { label?: string; strokeColor?: string; inputStyle?: StyleProp<ViewStyle> }) {
  return (
    <View className="gap-[9px]">
      {!!label && <Text className="font-brockmann-medium text-sm leading-5">{label}</Text>}
      <View
        style={[
          { backgroundColor: colors.uiPrimary, borderRadius: 2, borderWidth: 1, borderColor: strokeColor, paddingHorizontal: 16, paddingVertical: 12 },
          inputStyle,
        ]}
      >
        <TextInput
          placeholderTextColor={colors.textGrey}
          {...props}
          style={[{ fontFamily: "Brockmann-Medium", fontSize: 14, lineHeight: 20, color: colors.textPrimary, padding: 0 }, props.style]}
        />
      </View>
    </View>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <View className="rounded border border-[#EF4444] bg-[#FEE2E2] p-3">
      <Text className="font-brockmann-medium text-sm text-[#DC2626]">{children}</Text>
    </View>
  );
}

// Pill-shaped tag, e.g. "Multiplayer" / "Local" / "In progress".
export function StatusPill({
  label,
  bg,
  border,
  color,
}: {
  label: string;
  bg: string;
  border?: string;
  color: string;
}) {
  return (
    <View
      className="self-start rounded-full px-3 py-1"
      style={{ backgroundColor: bg, borderWidth: border ? 0.5 : 0, borderColor: border }}
    >
      <Text className="font-brockmann-semibold text-xs" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

// Category chip (web: #25015E fill, 1px #907AFF stroke, 12/16).
export function CategoryChip({ label }: { label: string }) {
  return (
    <View className="self-start rounded border border-purple-300 bg-purple-800 px-2 py-1">
      <Text className="text-xs leading-4" style={{ letterSpacing: 0.72 }}>
        {label}
      </Text>
    </View>
  );
}

// ───────────────────────────── Tabs ─────────────────────────────
// Segmented pill control: rounded-full, 1px #49474B border, segments separated by 1px gaps.
export function PillTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View
      className="flex-row overflow-hidden rounded-full border border-greyscale-purp-700"
      style={{ backgroundColor: colors.itemStroke, gap: 1 }}
    >
      {tabs.map((t) => (
        <Pressable
          key={t.key}
          onPress={() => onChange(t.key)}
          className={`flex-1 items-center px-4 py-3 ${value === t.key ? "bg-brand" : "bg-card"}`}
        >
          <Text className="font-brockmann-medium text-sm leading-5">{t.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ───────────────────────────── Rank badge ─────────────────────────────
const RANK_RINGS: Record<number, { ring: readonly [string, string]; fill: string }> = {
  1: { ring: ["#FFF2B2", "#F0AA11"], fill: "#FFD60A" },
  2: { ring: ["#E5E5E5", "#666666"], fill: "#CCCCCC" },
  3: { ring: ["#FFAE78", "#95430C"], fill: "#DE7E3E" },
};

export function RankBadge({ rank, size = 32 }: { rank: number; size?: number }) {
  const podium = RANK_RINGS[rank];
  const label = (
    <Text
      className="font-brockmann-bold"
      style={{ fontSize: 16, color: podium ? "#1D1D1F" : "#0E0F0F" }}
    >
      {rank}
    </Text>
  );
  if (!podium) {
    return (
      <View
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#907AFF", alignItems: "center", justifyContent: "center" }}
      >
        {label}
      </View>
    );
  }
  return (
    <LinearGradient
      colors={[...podium.ring]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, padding: 2 }}
    >
      <View
        style={{ flex: 1, borderRadius: size / 2, backgroundColor: podium.fill, alignItems: "center", justifyContent: "center" }}
      >
        {label}
      </View>
    </LinearGradient>
  );
}

// ───────────────────────────── Avatar ─────────────────────────────
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
