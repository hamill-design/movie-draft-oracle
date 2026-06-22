import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../contexts/AuthContext";

// Decides where to send you on launch: the leagues list if you're signed in,
// the login screen if you're not.
export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-ink">
        <ActivityIndicator color="#680AFF" />
      </View>
    );
  }

  return <Redirect href={session ? "/leagues" : "/login"} />;
}
