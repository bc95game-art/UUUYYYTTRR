import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, NativeSyntheticEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type FileDownload, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import * as FileSystem from "expo-file-system/legacy";
import { useVideoPlayer, VideoView } from "expo-video";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import { decode, payloadOf } from "../../features/bridge/protocol";
import { SITE_BRIDGE_JS } from "../../features/browser/site-bridge";
import { downloadDirect } from "../../features/offline/downloader";
import { BlobTransferManager } from "../../features/offline/blob-transfer";
import { initialLibraryState, libraryReducer } from "../../features/offline/reducer";
import { offlineRepository } from "../../features/offline/repository";
import type { OfflineVideo } from "../../features/offline/types";

const SITE = "https://biomaze.ir/";
const PANEL_URI = "file:///android_asset/panel-5.html";
type Mode = "ui" | "browser" | "player";

function NativePlayer({ file, onClose }: { file: OfflineVideo; onClose: () => void }) {
  const player = useVideoPlayer(file.localUri, (p) => { p.play(); });
  return <View style={styles.player}><SafeAreaView edges={["top"]} style={styles.playerBar}><Pressable onPress={onClose} style={styles.close}><MaterialIcons name="arrow-forward" size={24} color="#fff" /></Pressable><Text style={styles.playerTitle} numberOfLines={1}>{file.displayName}</Text></SafeAreaView><VideoView player={player} style={styles.video} nativeControls /></View>;
}

export default function HomeScreen() {
  const webRef = useRef<WebView>(null);
  const filesRef = useRef<OfflineVideo[]>([]);
  const blobTransfers = useRef(new BlobTransferManager()).current;
  const [mode, setMode] = useState<Mode>("ui");
  const [browserUrl, setBrowserUrl] = useState(SITE);
  const [browserSourceUrl, setBrowserSourceUrl] = useState(SITE);
  const browserUrlRef = useRef(SITE);
  const [browserTitle, setBrowserTitle] = useState("biomaze.ir");
  const [browserCanGoBack, setBrowserCanGoBack] = useState(false);
  const [activeFile, setActiveFile] = useState<OfflineVideo | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [browserError, setBrowserError] = useState<string | null>(null);
  const browserLoadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, dispatch] = useReducer(libraryReducer, initialLibraryState);

  const applySnapshot = useCallback((next: OfflineVideo[]) => { filesRef.current = next; }, []);
  const refreshFiles = useCallback(async () => { const snapshot = await offlineRepository.initialize(); applySnapshot(snapshot.files); dispatch({ type: "SNAPSHOT", revision: snapshot.revision }); return snapshot.files; }, [applySnapshot]);
  useEffect(() => { void refreshFiles().catch((e) => dispatch({ type: "ERROR", message: String(e?.message || e) })); }, [refreshFiles]);
  useEffect(() => { const sub = BackHandler.addEventListener("hardwareBackPress", () => { if (mode === "player") { setMode("ui"); return true; } if (mode === "browser" && browserCanGoBack) { webRef.current?.goBack(); return true; } if (mode === "browser") { setMode("ui"); return true; } return false; }); return () => sub.remove(); }, [mode, browserCanGoBack]);

  const pushSnapshot = useCallback((list = filesRef.current, revision = state.revision) => { webRef.current?.injectJavaScript(`window.receiveFilesSnapshot && window.receiveFilesSnapshot(${JSON.stringify({ revision, files: list })}); true;`); }, [state.revision]);
  const sendFiles = useCallback(async () => { const snapshot = await offlineRepository.refresh(); applySnapshot(snapshot.files); dispatch({ type: "SNAPSHOT", revision: snapshot.revision }); pushSnapshot(snapshot.files, snapshot.revision); }, [applySnapshot, pushSnapshot]);

  const downloadVideo = useCallback(async (url: string, nameHint?: string) => {
    try {
      const result = await downloadDirect(url, nameHint);
      const snapshot = await offlineRepository.refresh();
      applySnapshot(snapshot.files);
      dispatch({ type: "SNAPSHOT", revision: snapshot.revision });
      pushSnapshot(snapshot.files, snapshot.revision);
      void result;
    } catch {
      setUiError("ذخیرهٔ ویدئو انجام نشد؛ فایل ناقص وارد کتابخانه نشد.");
    }
  }, [applySnapshot, pushSnapshot]);

  const onMessage = useCallback(async (event: WebViewMessageEvent) => {
    const message = decode(event.nativeEvent.data); if (!message) return;
    const p = payloadOf<Record<string, any>>(message);
    try {
      if (message.type === "panel.ready") { const snapshot = await offlineRepository.initialize(); applySnapshot(snapshot.files); dispatch({ type: "SNAPSHOT", revision: snapshot.revision }); pushSnapshot(snapshot.files, snapshot.revision); return; }
      if (message.type === "open-site") { const next = browserUrlRef.current || String(p.url || SITE); browserUrlRef.current = next; setBrowserUrl(next); setBrowserSourceUrl(next); setUiError(null); setBrowserError(null); setMode("browser"); return; }
      if (message.type === "download.url") { await downloadVideo(String(p.url || ""), String(p.name || "")); return; }
      if (message.type === "transfer.start") { const id = String(p.transferId || ""); if (blobTransfers.start({ transferId: id, name: String(p.name || ""), mime: String(p.mime || "video/mp4"), total: Number(p.total), byteLength: Number(p.byteLength) })) dispatch({ type: "TRANSFER_START", id, total: Number(p.byteLength) }); return; }
      if (message.type === "transfer.chunk") { const id = String(p.transferId || ""); const index = Number(p.index); if (!blobTransfers.chunk(id, index, String(p.data || ""))) throw new Error("TRANSFER_CHUNK_REJECTED"); const progress = blobTransfers.progress(id); if (progress) dispatch({ type: "TRANSFER_PROGRESS", id, received: progress.received }); webRef.current?.injectJavaScript(`window.__mazAck && window.__mazAck(${JSON.stringify(id)},${index}); true;`); return; }
      if (message.type === "transfer.failed") { throw new Error(String(p.error || "BLOB_READ_FAILED")); }
      if (message.type === "transfer.complete") { const id = String(p.transferId || ""); dispatch({ type: "TRANSFER_VERIFY", id }); await blobTransfers.complete(id); dispatch({ type: "TRANSFER_COMMIT", id }); const snapshot = await offlineRepository.refresh(); applySnapshot(snapshot.files); dispatch({ type: "SNAPSHOT", revision: snapshot.revision }); pushSnapshot(snapshot.files, snapshot.revision); return; }
      if (message.type === "files.list") { await sendFiles(); return; }
      if (message.type === "file.open") { const file = filesRef.current.find((item) => item.id === String(p.id)); if (file) { const check = await FileSystem.getInfoAsync(file.localUri); if (check.exists) { setActiveFile(file); setMode("player"); } } return; }
      if (message.type === "file.delete") { const next = await offlineRepository.remove(String(p.id)); applySnapshot(next.files); dispatch({ type: "SNAPSHOT", revision: next.revision }); pushSnapshot(next.files, next.revision); return; }
      if (message.type === "file.rename") { const updated = await offlineRepository.rename(String(p.id), String(p.name || "")); const next = await offlineRepository.refresh(); applySnapshot(next.files); dispatch({ type: "SNAPSHOT", revision: next.revision }); pushSnapshot(next.files, next.revision); void updated; return; }
    } catch (error) { const messageText = String(error instanceof Error ? error.message : error); const transferId = String(p.transferId || ""); if (transferId) { blobTransfers.abort(transferId); webRef.current?.injectJavaScript(`window.__mazNack && window.__mazNack(${JSON.stringify(transferId)}); true;`); } dispatch({ type: "ERROR", message: messageText }); if (message.type.startsWith("transfer.")) dispatch({ type: "TRANSFER_FAIL", id: transferId, message: messageText }); setUiError("عملیات با فایل انجام نشد؛ فایل ناقص یا دسترسی‌ناپذیر است."); }
  }, [applySnapshot, blobTransfers, downloadVideo, pushSnapshot, sendFiles]);

  const onPanelLoad = useCallback(() => { setTimeout(() => pushSnapshot(), 80); }, [pushSnapshot]);
  const clearBrowserLoadTimer = useCallback(() => { if (browserLoadTimer.current) { clearTimeout(browserLoadTimer.current); browserLoadTimer.current = null; } }, []);
  const beginBrowserLoad = useCallback(() => {
    clearBrowserLoadTimer();
    setBrowserError(null);
    setBrowserLoading(true);
    browserLoadTimer.current = setTimeout(() => {
      setBrowserLoading(false);
      setBrowserError("بارگذاری صفحه بیش از حد طول کشید. اتصال را بررسی کنید یا دوباره تلاش کنید.");
    }, 20000);
  }, [clearBrowserLoadTimer]);
  const finishBrowserLoad = useCallback(() => { clearBrowserLoadTimer(); setBrowserLoading(false); }, [clearBrowserLoadTimer]);
  useEffect(() => () => clearBrowserLoadTimer(), [clearBrowserLoadTimer]);
  const onBrowserNavigation = (nav: WebViewNavigation) => { const next = nav.url || browserUrlRef.current; browserUrlRef.current = next; setBrowserUrl(next); setBrowserCanGoBack(nav.canGoBack); setBrowserTitle(nav.title || next.replace(/^https?:\/\//, "").split("/")[0]); };
  const onFileDownload = useCallback(async (event: NativeSyntheticEvent<FileDownload>) => { await downloadVideo(event.nativeEvent.downloadUrl); }, [downloadVideo]);
  const address = (browserUrl.replace(/^https?:\/\//, "").split("/")[0] || browserTitle || "biomaze.ir").toLowerCase();
  const retryBrowser = useCallback(() => { setBrowserError(null); beginBrowserLoad(); webRef.current?.reload(); }, [beginBrowserLoad]);
  const header = <SafeAreaView edges={["top"]} style={styles.headerSafe}><View style={styles.nativeHeader}><Pressable onPress={() => { finishBrowserLoad(); setMode("ui"); }} style={styles.headerButton}><MaterialIcons name="arrow-back" size={23} color="#18212b" /></Pressable><LinearGradient colors={["#14897F", "#3388FF", "#7B5CF0", "#E8557A"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.addressBar}><View style={styles.addressContent}><MaterialIcons name="lock" size={19} color="#fff" /><Text style={styles.addressText} numberOfLines={1}>{address}</Text></View></LinearGradient><Pressable onPress={retryBrowser} style={styles.headerButton}><MaterialIcons name="refresh" size={22} color="#18212b" /></Pressable></View></SafeAreaView>;
  if (mode === "player" && activeFile) return <NativePlayer file={activeFile} onClose={() => setMode("ui")} />;
  if (mode === "browser") return <View style={styles.root}><View style={styles.browserShell}>{header}<View style={styles.browserViewport}><WebView ref={webRef} source={{ uri: browserSourceUrl }} style={styles.browser} javaScriptEnabled domStorageEnabled allowsFullscreenVideo setSupportMultipleWindows={false} onLoadStart={beginBrowserLoad} onNavigationStateChange={onBrowserNavigation} onMessage={onMessage} injectedJavaScriptBeforeContentLoaded={SITE_BRIDGE_JS} onLoadEnd={() => { finishBrowserLoad(); webRef.current?.injectJavaScript(`${SITE_BRIDGE_JS}\ntrue;`); }} onFileDownload={onFileDownload} onError={(event) => { finishBrowserLoad(); setBrowserError(event.nativeEvent.description || "بارگذاری سایت ناموفق بود"); }} onHttpError={() => { finishBrowserLoad(); setBrowserError("سایت پاسخ مناسبی نداد؛ اتصال اینترنت و آدرس سایت را بررسی کنید."); }} /><View pointerEvents="none" style={[styles.browserLoader, (!browserLoading || browserError) && styles.hiddenLoader]}><ActivityIndicator size="large" color="#bfe8ff" /></View>{browserError ? <View style={styles.browserError}><Text style={styles.browserErrorTitle}>بارگذاری صفحه انجام نشد</Text><Text style={styles.browserErrorText}>{browserError}</Text><Pressable style={styles.retry} onPress={retryBrowser}><Text style={styles.retryText}>تلاش دوباره</Text></Pressable></View> : null}</View></View></View>;
  if (uiError) return <View style={styles.loader}><Text style={styles.errorTitle}>خطا در باز کردن محیط برنامه</Text><Text style={styles.loaderText}>{uiError}</Text><Pressable style={styles.retry} onPress={() => setUiError(null)}><Text style={styles.retryText}>تلاش دوباره</Text></Pressable></View>;
  return <View style={styles.root}><WebView ref={webRef} source={{ uri: PANEL_URI }} style={styles.browser} originWhitelist={["*"]} javaScriptEnabled domStorageEnabled allowFileAccess allowUniversalAccessFromFileURLs onMessage={onMessage} onLoadEnd={onPanelLoad} onError={(event) => setUiError(event.nativeEvent.description || "بارگذاری رابط برنامه ناموفق بود")} /></View>;
}

  const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: "#f1f1f3" }, browserShell: { flex: 1, backgroundColor: "#0D47A1" }, browserViewport: { flex: 1, backgroundColor: "#0D47A1", position: "relative" }, browser: { flex: 1, backgroundColor: "#0D47A1" }, browserLoader: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", backgroundColor: "#0D47A1" }, hiddenLoader: { opacity: 0 }, browserError: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", backgroundColor: "#0D47A1", padding: 24 }, browserErrorTitle: { color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 10 }, browserErrorText: { color: "#d9efff", fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 18 }, headerSafe: { backgroundColor: "#fff" }, nativeHeader: { height: 60, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 12, gap: 8 }, headerButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#f4f7f9", borderWidth: 1, borderColor: "#dfe5ea" }, addressBar: { flex: 1, height: 42, borderRadius: 22, justifyContent: "center" }, addressContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 10 }, addressText: { color: "#fff", fontSize: 14, fontWeight: "800", textAlign: "center" }, loader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f1f1f3", gap: 12, padding: 24 }, loaderText: { color: "#fff", fontSize: 13, textAlign: "center" }, errorTitle: { color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "center" }, retry: { backgroundColor: "#1d8fd0", borderRadius: 22, paddingHorizontal: 26, paddingVertical: 12 }, retryText: { color: "#fff", fontWeight: "700" }, player: { flex: 1, backgroundColor: "#000" }, playerBar: { minHeight: 58, backgroundColor: "#000", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 10 }, close: { width: 40, height: 40, alignItems: "center", justifyContent: "center" }, playerTitle: { flex: 1, color: "#fff", fontSize: 15, fontWeight: "800", textAlign: "right" }, video: { flex: 1, width: "100%" } });
