import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

export const unstable_settings = { anchor: "(tabs)" };

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const [details, setDetails] = useState(false);
  return (
    <View style={styles.root}>
      <Text style={styles.title}>ماز ویدیو متوقف شد</Text>
      <Text style={styles.message}>رابط برنامه با خطای پیش‌بینی‌نشده روبه‌رو شد. فایل‌های ذخیره‌شده حذف نشده‌اند.</Text>
      <Pressable accessibilityRole="button" onPress={retry} style={styles.button}><Text style={styles.buttonText}>راه‌اندازی دوباره</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => setDetails((value) => !value)}><Text style={styles.detailsToggle}>{details ? "پنهان کردن جزئیات" : "نمایش جزئیات"}</Text></Pressable>
      {details ? <Text selectable style={styles.details}>{error.message}</Text> : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(tabs)" /></Stack>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f1f1f3", padding: 28 },
  title: { color: "#18212b", fontSize: 22, fontWeight: "800", marginBottom: 12, textAlign: "center" },
  message: { color: "#53606c", fontSize: 15, lineHeight: 24, textAlign: "center", marginBottom: 22 },
  button: { backgroundColor: "#fff", borderRadius: 24, paddingHorizontal: 26, paddingVertical: 13 },
  buttonText: { color: "#0D47A1", fontWeight: "800" },
  detailsToggle: { color: "#1d8fd0", marginTop: 18 },
  details: { color: "#18212b", marginTop: 12, textAlign: "center" },
});
