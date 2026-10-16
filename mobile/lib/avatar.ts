import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

// Profile photo chosen during sign-up. The new account can't upload until it has a
// session (email confirmation), so — like the website — the pick is held on the device
// and uploaded after the first sign-in. Same bucket/path as the web: avatars/{userId}/avatar.jpg.
const PENDING_KEY = "md_pending_avatar";
const MAX_BYTES = 5 * 1024 * 1024;
const VALID_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

export function validateAvatar(asset: { mimeType?: string | null; fileSize?: number | null }): string | null {
  if (asset.mimeType && !VALID_TYPES.includes(asset.mimeType)) return "Please upload a PNG, JPEG, or WebP image.";
  if (asset.fileSize && asset.fileSize > MAX_BYTES) return "File size exceeds 5MB. Please upload a smaller image.";
  return null;
}

export async function savePendingAvatar(uri: string): Promise<void> {
  await AsyncStorage.setItem(PENDING_KEY, uri);
}

export async function uploadPendingAvatar(userId: string): Promise<void> {
  const uri = await AsyncStorage.getItem(PENDING_KEY);
  if (!uri) return;
  try {
    const blob = await (await fetch(uri)).blob();
    const path = `${userId}/avatar.jpg`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { contentType: "image/jpeg", upsert: true, cacheControl: "3600" });
    if (error) throw error;
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: `${data.publicUrl}?t=${Date.now()}` }).eq("id", userId);
  } catch (e) {
    console.warn("Failed to upload pending avatar:", e);
  } finally {
    await AsyncStorage.removeItem(PENDING_KEY);
  }
}
