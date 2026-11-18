import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Asset } from "expo-asset";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import * as FileSystem from "expo-file-system/legacy";
import { useVideoPlayer, VideoView } from "expo-video";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const SITE = "https://biomaze.ir/";
const OFFLINE_DIR = `${FileSystem.documentDirectory ?? ""}offline/`;
type OfflineFile = { id: number; uri: string; name: string; size: number; date: string };

type Mode = "ui" | "browser" | "player";

function NativePlayer({ file, onClose }: { file: OfflineFile; onClose: () => void }) {
  const player = useVideoPlayer(file.uri, (p) => { p.play(); });
  return <View style={styles.player}><SafeAreaView edges={["top"]} style={styles.playerBar}><Pressable onPress={onClose} style={styles.close}><MaterialIcons name="arrow-forward" size={24} color="#fff" /></Pressable><Text style={styles.playerTitle} numberOfLines={1}>{file.name}</Text></SafeAreaView><VideoView player={player} style={styles.video} nativeControls /></View>;
}

export default function HomeScreen() {
  const webRef = useRef<WebView>(null);
  const [mode, setMode] = useState<Mode>("ui");
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const [browserUrl, setBrowserUrl] = useState(SITE);
  const [browserTitle, setBrowserTitle] = useState("biomaze.ir");
  const [browserCanGoBack, setBrowserCanGoBack] = useState(false);
  const [files, setFiles] = useState<OfflineFile[]>([]);
  const [activeFile, setActiveFile] = useState<OfflineFile | null>(null);
  const [loading, setLoading] = useState(true);

  const readFiles = useCallback(async () => {
    if (!FileSystem.documentDirectory) return [];
    await FileSystem.makeDirectoryAsync(OFFLINE_DIR, { intermediates: true }).catch(() => undefined);
    const names = await FileSystem.readDirectoryAsync(OFFLINE_DIR).catch(() => []);
    const output: OfflineFile[] = [];
    for (const [index, name] of names.filter((x) => !x.startsWith(".")).entries()) {
      const uri = `${OFFLINE_DIR}${name}`;
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists || info.isDirectory) continue;
      const bytes = "size" in info && typeof info.size === "number" ? info.size : 0;
      output.push({ id: index + 1, uri, name, size: Math.max(1, Math.round(bytes / 1024 / 1024)), date: "ذخیره‌شده در این برنامه" });
    }
    setFiles(output);
    return output;
  }, []);

  useEffect(() => { Asset.fromModule(require("../../assets/panel-5.html")).downloadAsync().then((asset) => setHtmlUri(asset.localUri ?? asset.uri)).catch(() => setLoading(false)); readFiles(); }, [readFiles]);
  useEffect(() => { const sub = BackHandler.addEventListener("hardwareBackPress", () => { if (mode === "player") { setMode("ui"); return true; } if (mode === "browser" && browserCanGoBack) { webRef.current?.goBack(); return true; } if (mode === "browser") { setMode("ui"); return true; } return false; }); return () => sub.remove(); }, [mode, browserCanGoBack]);

  const sendFiles = useCallback(async () => {
    const latest = await readFiles();
    webRef.current?.injectJavaScript(`window.receiveFiles(${JSON.stringify(latest.map(({ id, name, size, date }) => ({ id, name, size, date })))}); true;`);
  }, [readFiles]);

  const onMessage = useCallback(async (event: WebViewMessageEvent) => {
    let message: { type?: string; url?: string; id?: number; name?: string } = {};
    try { message = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (message.type === "open-site") { setBrowserUrl(message.url || SITE); setMode("browser"); return; }
    if (message.type === "list-files") { await sendFiles(); return; }
    if (message.type === "open-file" && message.id) { const file = files.find((x) => x.id === message.id); if (file) { setActiveFile(file); setMode("player"); } return; }
    if (message.type === "delete-file" && message.id) { const file = files.find((x) => x.id === message.id); if (file) await FileSystem.deleteAsync(file.uri, { idempotent: true }); await sendFiles(); return; }
    if (message.type === "rename-file" && message.id && message.name?.trim()) { const file = files.find((x) => x.id === message.id); if (file) { const safe = message.name.trim().replace(/[\\/:*?"<>|]/g, "_"); await FileSystem.moveAsync({ from: file.uri, to: `${OFFLINE_DIR}${safe}` }); } await sendFiles(); return; }
    if (message.type === "clear-cache") { await FileSystem.deleteAsync(`${FileSystem.cacheDirectory ?? ""}`, { idempotent: true }).catch(() => undefined); }
    if (message.type === "clear-history") { webRef.current?.clearHistory?.(); }
  }, [files, sendFiles]);

  const onBrowserNavigation = (nav: WebViewNavigation) => { setBrowserCanGoBack(nav.canGoBack); setBrowserTitle(nav.title || nav.url.replace(/^https?:\/\//, "").split("/")[0]); };
  const header = <SafeAreaView edges={["top"]} style={styles.nativeHeader}><Pressable onPress={() => setMode("ui")} style={styles.headerButton}><MaterialIcons name="arrow-forward" size={23} color="#fff" /></Pressable><Text style={styles.headerTitle} numberOfLines={1}>{browserTitle}</Text><Pressable onPress={() => webRef.current?.reload()} style={styles.headerButton}><MaterialIcons name="refresh" size={22} color="#fff" /></Pressable></SafeAreaView>;
  if (mode === "player" && activeFile) return <NativePlayer file={activeFile} onClose={() => setMode("ui")} />;
  if (mode === "browser") return <View style={styles.root}>{header}<WebView ref={webRef} source={{ uri: browserUrl }} style={styles.browser} javaScriptEnabled domStorageEnabled allowsFullscreenVideo setSupportMultipleWindows={false} onNavigationStateChange={onBrowserNavigation} startInLoadingState renderLoading={() => <View style={styles.loader}><ActivityIndicator size="large" color="#1d8fd0" /></View>} /></View>;
  if (!htmlUri || loading) return <View style={styles.loader}><ActivityIndicator size="large" color="#1d8fd0" /><Text style={styles.loaderText}>در حال آماده‌سازی مرورگر…</Text></View>;
  return <View style={styles.root}><WebView ref={webRef} source={{ uri: htmlUri }} style={styles.browser} originWhitelist={["*"]} javaScriptEnabled domStorageEnabled allowFileAccess allowUniversalAccessFromFileURLs onMessage={onMessage} onLoadEnd={() => { setLoading(false); sendFiles(); }} /></View>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: "#0d1620" }, browser: { flex: 1, backgroundColor: "#0d1620" }, nativeHeader: { minHeight: 58, backgroundColor: "#0d1620", flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 10, gap: 10 }, headerButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#1d8fd0" }, headerTitle: { flex: 1, color: "#fff", fontSize: 15, fontWeight: "800", textAlign: "center" }, loader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0d1620", gap: 12 }, loaderText: { color: "#fff", fontSize: 13 }, player: { flex: 1, backgroundColor: "#000" }, playerBar: { minHeight: 58, backgroundColor: "#000", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 10 }, close: { width: 40, height: 40, alignItems: "center", justifyContent: "center" }, playerTitle: { flex: 1, color: "#fff", fontSize: 15, fontWeight: "800", textAlign: "right" }, video: { flex: 1, width: "100%" } });
