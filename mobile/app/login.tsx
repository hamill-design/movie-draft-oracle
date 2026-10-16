import { useEffect, useState } from "react";
import { Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Svg, { Path } from "react-native-svg";
import { AlertCircle, Camera, Check } from "lucide-react-native";
import { useAuth } from "../contexts/AuthContext";
import { savePendingAvatar, uploadPendingAvatar, validateAvatar } from "../lib/avatar";
import { takePendingRoute } from "../lib/pendingRoute";
import { cardGlow, colors } from "../lib/theme";
import { AppHeader, Button, ErrorBanner, Field, GlowCard, Text, initialsOf } from "../components/ui";

// Same layout and copy as the website's Auth page: one centred card with
// Google first, an "or" divider, then the email form.

type Mode = "signin" | "signup" | "reset" | "photo";

function GoogleG() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
      <Path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
      <Path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
      <Path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
    </Svg>
  );
}

export default function Login() {
  const { session, signIn, signUp, resetPassword, signInWithGoogle } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; mode?: string }>();

  const [mode, setMode] = useState<Mode>(params.mode === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState(params.email ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState("");

  // Once signed in (email or Google), go where the person was headed — e.g. an invite link — else the leagues list.
  useEffect(() => {
    if (!session || mode === "photo") return;
    takePendingRoute().then((route) => router.replace((route ?? "/leagues") as never));
  }, [session, mode]);

  const reset = (next: Mode) => {
    setMode(next);
    setError("");
    setInfo("");
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    setInfo("");

    if (mode === "reset") {
      const { error: e } = await resetPassword(email.trim());
      setBusy(false);
      if (e) setError(e);
      else setInfo("Reset email sent! Please check your email for password reset instructions.");
      return;
    }

    if (mode === "signin") {
      const { error: e } = await signIn(email.trim(), password);
      setBusy(false);
      if (e) {
        setError(
          e.toLowerCase().includes("invalid login")
            ? "Invalid email or password. Please check your credentials."
            : e,
        );
      }
      return;
    }

    const { error: e } = await signUp(email.trim(), password, name, marketingOptIn);
    setBusy(false);
    if (e) setError(e);
    else setMode("photo");
  };

  const google = async () => {
    setGoogleBusy(true);
    setError("");
    const { error: e } = await signInWithGoogle();
    setGoogleBusy(false);
    if (e) setError(e);
  };

  const choosePhoto = async () => {
    setPhotoError("");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const problem = validateAvatar(asset);
    if (problem) setPhotoError(problem);
    else setPhotoUri(asset.uri);
  };

  const finishSignup = async (withPhoto: boolean) => {
    if (withPhoto && photoUri) {
      await savePendingAvatar(photoUri);
      // If sign-up already produced a session (no email confirmation), upload right away.
      if (session?.user) await uploadPendingAvatar(session.user.id);
    }
    if (session) {
      setMode("signin"); // the effect above then routes onward
      return;
    }
    setPassword("");
    setMode("signin");
    setInfo("Account created! Please check your email to confirm your account.");
  };

  const title =
    mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : mode === "reset" ? "Reset password" : "Add a profile photo";

  return (
    <View className="flex-1">
      <AppHeader showBack={false} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 16 }}
        >
          <GlowCard style={{ width: "100%", maxWidth: 448, alignSelf: "center", borderRadius: 4 }}>
            <Text className="pt-1.5 text-center font-brockmann-medium text-xl leading-7">{title}</Text>

            {mode === "photo" ? (
              <View className="items-center gap-4">
                <Text className="text-center text-sm leading-5 text-greyscale-blue-300">
                  You can add a photo now or do it later from your profile.
                </Text>
                <Pressable
                  onPress={choosePhoto}
                  className="h-24 w-24 items-center justify-center overflow-hidden rounded-full"
                  style={{ borderWidth: photoUri ? 0 : 2, borderStyle: "dashed", borderColor: colors.buttonStroke, backgroundColor: colors.uiPrimary }}
                >
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={{ width: 96, height: 96 }} />
                  ) : (
                    <View className="items-center gap-1">
                      <Camera size={20} color={colors.textGrey} />
                      <Text className="text-[11px] text-greyscale-blue-300">{initialsOf(name || email)}</Text>
                    </View>
                  )}
                </Pressable>
                {!!photoError && <ErrorBanner>{photoError}</ErrorBanner>}
                <Button label={photoUri ? "Change photo" : "Choose photo"} variant="outline" small inline onPress={choosePhoto} />
                <View className="w-full">
                  <Button label="Continue" variant="brand" disabled={!photoUri} onPress={() => finishSignup(true)} />
                </View>
                <Pressable onPress={() => finishSignup(false)} hitSlop={8}>
                  <Text className="text-sm text-greyscale-blue-300 underline">Skip for now</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {mode !== "reset" && (
                  <>
                    <Button
                      label={googleBusy ? "Redirecting..." : "Continue with Google"}
                      variant="outline"
                      icon={<GoogleG />}
                      disabled={googleBusy}
                      onPress={google}
                    />
                    <View className="flex-row items-center gap-3">
                      <View className="h-px flex-1 bg-greyscale-purp-600" />
                      <Text className="text-[13px] text-greyscale-blue-300">or</Text>
                      <View className="h-px flex-1 bg-greyscale-purp-600" />
                    </View>
                  </>
                )}

                {!!error && (
                  <View className="flex-row items-start gap-2 rounded border border-[#EF4444] bg-[#FEE2E2] p-3">
                    <AlertCircle size={16} color="#DC2626" />
                    <Text className="flex-1 font-brockmann-medium text-sm text-[#DC2626]">{error}</Text>
                  </View>
                )}
                {!!info && (
                  <View className="rounded border border-teal-200 bg-teal-900 p-3">
                    <Text className="font-brockmann-medium text-sm text-teal-200">{info}</Text>
                  </View>
                )}

                <View className="gap-4">
                  <Field
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter Email Address"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {mode === "signup" && (
                    <Field label="Name" value={name} onChangeText={setName} placeholder="Enter Your Name" autoCapitalize="words" />
                  )}
                  {mode !== "reset" && (
                    <Field
                      label="Password"
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Enter Password"
                      secureTextEntry
                      autoCapitalize="none"
                    />
                  )}
                </View>

                {mode === "signup" && (
                  <Pressable onPress={() => setMarketingOptIn((v) => !v)} className="flex-row items-start gap-3">
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        marginTop: 2,
                        borderRadius: 4,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: colors.accent,
                        backgroundColor: marketingOptIn ? colors.brand : "transparent",
                      }}
                    >
                      {marketingOptIn && <Check size={13} color="#FCFFFF" />}
                    </View>
                    <Text className="flex-1 text-[13px] leading-5 text-greyscale-blue-300">
                      I want to receive product updates and occasional news from Movie Drafter. See our{" "}
                      <Text
                        className="text-[13px] text-brand"
                        onPress={() => Linking.openURL("https://moviedrafter.com/privacy-policy")}
                      >
                        Privacy Policy
                      </Text>
                      .
                    </Text>
                  </Pressable>
                )}

                {mode === "signin" && (
                  <Pressable onPress={() => reset("reset")} className="-mt-3 self-end" hitSlop={8}>
                    <Text className="text-sm text-greyscale-blue-300">Forgot your password?</Text>
                  </Pressable>
                )}

                <Button
                  label={
                    busy
                      ? mode === "reset"
                        ? "Sending..."
                        : "Please wait..."
                      : mode === "signin"
                        ? "Login"
                        : mode === "signup"
                          ? "Sign Up"
                          : "Send Reset Email"
                  }
                  variant="brand"
                  disabled={busy || !email.trim() || (mode !== "reset" && !password)}
                  onPress={submit}
                />

                {mode === "reset" ? (
                  <Button label="Back to Sign In" variant="link" inline onPress={() => reset("signin")} />
                ) : (
                  <View className="items-center">
                    <Text className="mb-1.5 text-sm text-greyscale-blue-300">
                      {mode === "signin" ? "Don't have an account?" : "Already have an account?"}
                    </Text>
                    <Button
                      label={mode === "signin" ? "Create account" : "Sign in instead"}
                      variant="link"
                      inline
                      onPress={() => reset(mode === "signin" ? "signup" : "signin")}
                    />
                  </View>
                )}
              </>
            )}
          </GlowCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
