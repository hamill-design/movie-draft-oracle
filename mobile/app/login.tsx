import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { session, signIn, signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  // Once a session exists (via email or Google), leave the login screen.
  useEffect(() => {
    if (session) router.replace("/leagues");
  }, [session]);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    const action = mode === "signin" ? signIn : signUp;
    const { error } = await action(email.trim(), password);
    setBusy(false);

    if (error) {
      setMessage(error);
      return;
    }
    if (mode === "signup") {
      setMessage("Account created — check your email to confirm, then sign in.");
      setMode("signin");
    }
  };

  const google = async () => {
    setGoogleBusy(true);
    setMessage(null);
    const { error } = await signInWithGoogle();
    setGoogleBusy(false);
    if (error) setMessage(error);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-ink"
    >
      <View className="flex-1 justify-center px-7">
        <Text className="text-4xl font-bold text-white">Movie Drafter</Text>
        <Text className="mb-8 mt-2 text-base text-white/60">
          {mode === "signin" ? "Sign in to your account" : "Create your account"}
        </Text>

        <TextInput
          className="mb-3 rounded-xl bg-white/10 px-4 py-4 text-base text-white"
          placeholder="Email"
          placeholderTextColor="#ffffff66"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          className="mb-3 rounded-xl bg-white/10 px-4 py-4 text-base text-white"
          placeholder="Password"
          placeholderTextColor="#ffffff66"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {message ? (
          <Text className="mb-3 text-sm text-amber-300">{message}</Text>
        ) : null}

        <Pressable
          className="mt-2 items-center rounded-xl bg-brand py-4 active:opacity-80"
          disabled={busy}
          onPress={submit}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">
              {mode === "signin" ? "Sign in" : "Create account"}
            </Text>
          )}
        </Pressable>

        <View className="my-5 flex-row items-center">
          <View className="h-px flex-1 bg-white/15" />
          <Text className="mx-3 text-xs text-white/40">or</Text>
          <View className="h-px flex-1 bg-white/15" />
        </View>

        <Pressable
          className="items-center rounded-xl border border-white/20 bg-white/5 py-4 active:opacity-80"
          disabled={googleBusy}
          onPress={google}
        >
          {googleBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">
              Continue with Google
            </Text>
          )}
        </Pressable>

        <Pressable
          className="mt-5 items-center"
          onPress={() => {
            setMessage(null);
            setMode(mode === "signin" ? "signup" : "signin");
          }}
        >
          <Text className="text-sm text-white/60">
            {mode === "signin"
              ? "No account? Create one"
              : "Already have an account? Sign in"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
