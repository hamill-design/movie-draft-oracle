import "../global.css";
import { useEffect } from "react";
import { View } from "react-native";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../contexts/AuthContext";
import { gradient } from "../lib/theme";

// Navigation paints a solid card behind every screen; make it transparent so the gradient shows through.
const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: "transparent", card: "transparent" },
};

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // Brockmann (UI text) and Chaney (big headings) — same fonts as the website.
  const [fontsLoaded, fontError] = useFonts({
    "Brockmann-Regular": require("../assets/fonts/Brockmann-Regular.ttf"),
    "Brockmann-Medium": require("../assets/fonts/Brockmann-Medium.ttf"),
    "Brockmann-SemiBold": require("../assets/fonts/Brockmann-SemiBold.ttf"),
    "Brockmann-Bold": require("../assets/fonts/Brockmann-Bold.ttf"),
    Chaney: require("../assets/fonts/Chaney.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        {/* One pinned purple gradient behind every screen, like the website's body background. */}
        <View style={{ flex: 1, backgroundColor: "#100029" }}>
          <LinearGradient
            colors={[...gradient.colors]}
            locations={[...gradient.locations]}
            start={gradient.start}
            end={gradient.end}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <ThemeProvider value={navTheme}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }} />
          </ThemeProvider>
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
