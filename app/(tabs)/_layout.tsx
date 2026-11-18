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
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.tint, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: { fontSize: 11, fontWeight: "600" }, tabBarStyle: { height: 62 + bottomPadding, paddingTop: 7, paddingBottom: bottomPadding, backgroundColor: colors.background, borderTopColor: colors.border } }}>
    <Tabs.Screen name="index" options={{ title: "خانه", tabBarIcon: ({ color }) => <TabIcon name="home-filled" color={color} /> }} />
    <Tabs.Screen name="browser" options={{ title: "مرورگر", tabBarIcon: ({ color }) => <TabIcon name="language" color={color} /> }} />
    <Tabs.Screen name="library" options={{ title: "ذخیره‌شده", tabBarIcon: ({ color }) => <TabIcon name="download-for-offline" color={color} /> }} />
    <Tabs.Screen name="settings" options={{ title: "تنظیمات", tabBarIcon: ({ color }) => <TabIcon name="tune" color={color} /> }} />
  </Tabs>;
}
