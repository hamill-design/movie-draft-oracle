import AsyncStorage from "@react-native-async-storage/async-storage";

// Where to go after signing in (e.g. an invite link someone tapped while signed out).
const KEY = "md_pending_route";

export async function setPendingRoute(path: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, path);
  } catch {
    /* best effort */
  }
}

export async function takePendingRoute(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v) await AsyncStorage.removeItem(KEY);
    return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
  } catch {
    return null;
  }
}
