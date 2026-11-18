import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useColors } from "@/hooks/use-colors";

function TabIcon({ name, color }: { name: React.ComponentProps<typeof MaterialIcons>["name"]; color: React.ComponentProps<typeof MaterialIcons>["color"] }) {
  return <MaterialIcons name={name} size={23} color={color} />;
}

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 8);
  return <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}>
    <Tabs.Screen name="index" options={{ title: "مرورگر" }} />
    <Tabs.Screen name="browser" options={{ href: null }} />
    <Tabs.Screen name="library" options={{ href: null }} />
    <Tabs.Screen name="settings" options={{ href: null }} />
  </Tabs>;
}
