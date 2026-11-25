import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, NativeSyntheticEvent, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type FileDownload, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import * as FileSystem from "expo-file-system/legacy";
import { useVideoPlayer, VideoView } from "expo-video";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import { decode, encode, payloadOf } from "../../features/bridge/protocol";
import { initialLibraryState, libraryReducer } from "../../features/offline/reducer";
import { offlineRepository, OFFLINE_DIR, cleanName } from "../../features/offline/repository";
import type { OfflineVideo } from "../../features/offline/types";

const SITE = "https://biomaze.ir/";
const PANEL_URI = "file:///android_asset/panel-5.html";
const MAX_TRANSFER_BYTES = 300 * 1024 * 1024;

type Mode = "ui" | "browser" | "player";
type Transfer = { name: string; mime: string; total: number; byteLength: number; chunks: Array<string | undefined> };

const BROWSER_BRIDGE_JS = `(function(){
  var MAX=300*1024*1024, seen=window.__mazSeenOffline||(window.__mazSeenOffline={});
  function send(type,payload){if(window.ReactNativeWebView&&window.ReactNativeWebView.postMessage)window.ReactNativeWebView.postMessage(JSON.stringify({protocolVersion:1,requestId:'web-'+Date.now()+'-'+Math.random().toString(16).slice(2),type:type,payload:payload||{}}));}
  function safe(n){return String(n||'biomaze-video.mp4').replace(/[^\\w\\u0600-\\u06ff.() _-]+/g,'_');}
  function isVideo(v){return /\\.(mp4|m4v|webm|mov|mkv|3gp|ts|m4s|m3u8)(?:[?#].*)?$/i.test(String(v||''));}
  function emit(blob,name,key){if(!blob||!blob.size||blob.size<1024||blob.size>MAX||seen[key])return;seen[key]=1;var id='blob-'+Date.now()+'-'+Math.random().toString(16).slice(2),r=new FileReader();r.onload=function(){var all=String(r.result||'').split(',')[1]||'',step=180000,total=Math.ceil(all.length/step),n=safe(name);send('transfer.start',{transferId:id,name:n,mime:blob.type||'video/mp4',total:total,byteLength:blob.size});for(var i=0;i<total;i++)send('transfer.chunk',{transferId:id,index:i,total:total,data:all.slice(i*step,(i+1)*step)});send('transfer.complete',{transferId:id,total:total});};r.readAsDataURL(blob);}
  function value(v,n){try{if(v instanceof Blob){emit(v,n,'blob:'+n+':'+v.size);return;}if(v instanceof ArrayBuffer){emit(new Blob([v],{type:'video/mp4'}),n,'array:'+n+':'+v.byteLength);return;}if(ArrayBuffer.isView&&ArrayBuffer.isView(v)){emit(new Blob([v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength)],{type:'video/mp4'}),n,'view:'+n+':'+v.byteLength);return;}if(typeof v==='string'){if(/^blob:/i.test(v))fetch(v).then(function(x){return x.blob();}).then(function(b){emit(b,n,v);}).catch(function(){});else if(/^https?:/i.test(v)&&isVideo(v))send('download.url',{url:v,name:safe(n||v.split('/').pop())});return;}if(!v||typeof v!=='object')return;Object.keys(v).slice(0,40).forEach(function(k){value(v[k],n||k);});}catch(e){}}
  function scanDb(){if(!window.indexedDB||!window.indexedDB.databases)return;window.indexedDB.databases().then(function(dbs){(dbs||[]).forEach(function(info){try{var req=indexedDB.open(info.name);req.onsuccess=function(){var db=req.result;Array.prototype.forEach.call(db.objectStoreNames,function(s){try{var q=db.transaction(s,'readonly').objectStore(s).getAll();q.onsuccess=function(){(q.result||[]).forEach(function(v,i){value(v,s+'-'+i+'.mp4');});};}catch(e){}});};}catch(e){}});}).catch(function(){});}
  function scanCache(){if(!window.caches)return;caches.keys().then(function(keys){(keys||[]).forEach(function(k){caches.open(k).then(function(c){return c.keys().then(function(reqs){(reqs||[]).forEach(function(req){c.match(req).then(function(r){if(r&&r.blob&&(((r.headers.get('content-type')||'').indexOf('video')>=0)||isVideo(req.url)))r.blob().then(function(b){emit(b, safe(req.url.split('/').pop()), 'cache:'+req.url);}).catch(function(){});});});});}).catch(function(){});});}).catch(function(){});}
  document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[download]'):null;if(a&&a.href)send('download.url',{url:a.href,name:a.getAttribute('download')||''});setTimeout(function(){scanDb();scanCache();},800);},true);
  function scan(){scanDb();scanCache();}window.__mazScanOffline=scan;setTimeout(scan,900);setInterval(scan,7000);document.addEventListener('visibilitychange',function(){if(!document.hidden)scan();});
})(); true;`;

function NativePlayer({ file, onClose }: { file: OfflineVideo; onClose: () => void }) {
  const player = useVideoPlayer(file.localUri, (p) => { p.play(); });
  return <View style={styles.player}><SafeAreaView edges={["top"]} style={styles.playerBar}><Pressable onPress={onClose} style={styles.close}><MaterialIcons name="arrow-forward" size={24} color="#fff" /></Pressable><Text style={styles.playerTitle} numberOfLines={1}>{file.displayName}</Text></SafeAreaView><VideoView player={player} style={styles.video} nativeControls /></View>;
}

export default function HomeScreen() {
  const webRef = useRef<WebView>(null);
  const filesRef = useRef<OfflineVideo[]>([]);
  const transfers = useRef<Record<string, Transfer>>({});
  const [mode, setMode] = useState<Mode>("ui");
  const [browserUrl, setBrowserUrl] = useState(SITE);
  const browserUrlRef = useRef(SITE);
  const [browserTitle, setBrowserTitle] = useState("biomaze.ir");
  const [browserCanGoBack, setBrowserCanGoBack] = useState(false);
  const [files, setFiles] = useState<OfflineVideo[]>([]);
  const [activeFile, setActiveFile] = useState<OfflineVideo | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [state, dispatch] = useReducer(libraryReducer, initialLibraryState);

  const applySnapshot = useCallback((next: OfflineVideo[]) => { filesRef.current = next; setFiles(next); }, []);
  const refreshFiles = useCallback(async () => { const snapshot = await offlineRepository.initialize(); applySnapshot(snapshot.files); dispatch({ type: "SNAPSHOT", revision: snapshot.revision }); return snapshot.files; }, [applySnapshot]);
  useEffect(() => { void refreshFiles().catch((e) => dispatch({ type: "ERROR", message: String(e?.message || e) })); }, [refreshFiles]);
  useEffect(() => { const sub = BackHandler.addEventListener("hardwareBackPress", () => { if (mode === "player") { setMode("ui"); return true; } if (mode === "browser" && browserCanGoBack) { webRef.current?.goBack(); return true; } if (mode === "browser") { setMode("ui"); return true; } return false; }); return () => sub.remove(); }, [mode, browserCanGoBack]);

  const pushSnapshot = useCallback((list = filesRef.current) => { webRef.current?.injectJavaScript(`window.receiveFilesSnapshot && window.receiveFilesSnapshot(${JSON.stringify({ revision: state.revision, files: list })}); true;`); }, [state.revision]);
  const sendFiles = useCallback(async () => { const list = await refreshFiles(); pushSnapshot(list); }, [pushSnapshot, refreshFiles]);

  const commitBlobTransfer = useCallback(async (id: string, transfer: Transfer) => {
    if (transfer.total <= 0 || transfer.total > 50000 || transfer.chunks.length !== transfer.total || transfer.chunks.some((chunk) => !chunk)) throw new Error("TRANSFER_INCOMPLETE");
    const base64 = transfer.chunks.join("");
    if (base64.length > MAX_TRANSFER_BYTES * 2) throw new Error("TRANSFER_TOO_LARGE");
    const temp = await offlineRepository.tempUri(id);
    await FileSystem.writeAsStringAsync(temp, base64, { encoding: FileSystem.EncodingType.Base64 });
    const info = await FileSystem.getInfoAsync(temp);
    if (!info.exists || !("size" in info) || !info.size) throw new Error("EMPTY_FILE");
    await offlineRepository.commitTemp(temp, cleanName(transfer.name), "webview-blob", undefined, transfer.mime);
    const next = await refreshFiles(); pushSnapshot(next);
  }, [pushSnapshot, refreshFiles]);

  const downloadVideo = useCallback(async (url: string, nameHint?: string) => {
    if (!/^https?:/i.test(url) || !FileSystem.documentDirectory) return;
    if (/\.m3u8(?:[?#]|$)/i.test(url)) { setUiError("این لینک فهرست پخش است و فایل ویدئویی مستقل نیست."); return; }
    const id = `download-${Date.now()}-${Math.random().toString(16).slice(2)}`; dispatch({ type: "TRANSFER_START", id, total: 0 });
    const temp = await offlineRepository.tempUri(id);
    try {
      await FileSystem.deleteAsync(temp, { idempotent: true });
      const result = await FileSystem.downloadAsync(url, temp);
      if (result.status < 200 || result.status >= 300) throw new Error("HTTP_ERROR");
      const info = await FileSystem.getInfoAsync(temp);
      if (!info.exists || !("size" in info) || !info.size) throw new Error("EMPTY_FILE");
      dispatch({ type: "TRANSFER_VERIFY", id });
      await offlineRepository.commitTemp(temp, cleanName(nameHint || url.split("?")[0].split("/").pop() || "biomaze-video.mp4"), "direct-download", url);
      dispatch({ type: "TRANSFER_COMMIT", id }); await refreshFiles().then(pushSnapshot);
    } catch (error) { await FileSystem.deleteAsync(temp, { idempotent: true }).catch(() => undefined); dispatch({ type: "TRANSFER_FAIL", id, message: String(error instanceof Error ? error.message : error) }); setUiError("ذخیرهٔ ویدئو انجام نشد؛ فایل ناقص وارد کتابخانه نشد."); }
  }, [pushSnapshot, refreshFiles]);

  const onMessage = useCallback(async (event: WebViewMessageEvent) => {
    const message = decode(event.nativeEvent.data); if (!message) return;
    const p = payloadOf<Record<string, any>>(message);
    try {
      if (message.type === "panel.ready") { pushSnapshot(); return; }
      if (message.type === "open-site") { const next = String(p.url || SITE); browserUrlRef.current = next; setBrowserUrl(next); setMode("browser"); return; }
      if (message.type === "download.url") { await downloadVideo(String(p.url || ""), String(p.name || "")); return; }
      if (message.type === "transfer.start") { const total = Number(p.total) || 0, bytes = Number(p.byteLength) || 0; if (!p.transferId || total <= 0 || bytes <= 0 || bytes > MAX_TRANSFER_BYTES) return; transfers.current[String(p.transferId)] = { name: String(p.name || "biomaze-video.mp4"), mime: String(p.mime || "video/mp4"), total, byteLength: bytes, chunks: new Array(total) }; dispatch({ type: "TRANSFER_START", id: String(p.transferId), total: bytes }); return; }
      if (message.type === "transfer.chunk") { const t = transfers.current[String(p.transferId)]; const index = Number(p.index); if (!t || !Number.isInteger(index) || index < 0 || index >= t.total || typeof p.data !== "string") return; if (!t.chunks[index]) t.chunks[index] = p.data; return; }
      if (message.type === "transfer.complete") { const id = String(p.transferId || ""), t = transfers.current[id]; if (!t) return; delete transfers.current[id]; dispatch({ type: "TRANSFER_VERIFY", id }); await commitBlobTransfer(id, t); return; }
      if (message.type === "files.list") { await sendFiles(); return; }
      if (message.type === "file.open") { const file = filesRef.current.find((item) => item.id === String(p.id)); if (file) { const check = await FileSystem.getInfoAsync(file.localUri); if (check.exists) { setActiveFile(file); setMode("player"); } } return; }
      if (message.type === "file.delete") { const next = await offlineRepository.remove(String(p.id)); applySnapshot(next.files); pushSnapshot(next.files); return; }
      if (message.type === "file.rename") { const updated = await offlineRepository.rename(String(p.id), String(p.name || "")); const next = await offlineRepository.refresh(); applySnapshot(next.files); pushSnapshot(next.files); void updated; return; }
    } catch (error) { dispatch({ type: "ERROR", message: String(error instanceof Error ? error.message : error) }); setUiError("عملیات با فایل انجام نشد؛ فایل ناقص یا دسترسی‌ناپذیر است."); }
  }, [applySnapshot, commitBlobTransfer, downloadVideo, pushSnapshot, sendFiles]);

  const onPanelLoad = useCallback(() => { setTimeout(() => pushSnapshot(), 80); }, [pushSnapshot]);
  const onBrowserNavigation = (nav: WebViewNavigation) => { const next = nav.url || browserUrlRef.current; browserUrlRef.current = next; setBrowserUrl(next); setBrowserCanGoBack(nav.canGoBack); setBrowserTitle(nav.title || next.replace(/^https?:\/\//, "").split("/")[0]); };
  const onFileDownload = useCallback(async (event: NativeSyntheticEvent<FileDownload>) => { await downloadVideo(event.nativeEvent.downloadUrl); }, [downloadVideo]);
  const address = (browserUrl.replace(/^https?:\/\//, "").split("/")[0] || browserTitle || "biomaze.ir").toLowerCase();
  const header = <SafeAreaView edges={["top"]} style={styles.headerSafe}><View style={styles.nativeHeader}><Pressable onPress={() => setMode("ui")} style={styles.headerButton}><MaterialIcons name="arrow-back" size={23} color="#18212b" /></Pressable><LinearGradient colors={["#14897F", "#3388FF", "#7B5CF0", "#E8557A"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.addressBar}><View style={styles.addressContent}><MaterialIcons name="lock" size={19} color="#fff" /><Text style={styles.addressText} numberOfLines={1}>{address}</Text></View></LinearGradient><Pressable onPress={() => webRef.current?.reload()} style={styles.headerButton}><MaterialIcons name="refresh" size={22} color="#18212b" /></Pressable></View></SafeAreaView>;
  if (mode === "player" && activeFile) return <NativePlayer file={activeFile} onClose={() => setMode("ui")} />;
  if (mode === "browser") return <View style={styles.root}><View style={styles.browserShell}>{header}<View style={styles.browserViewport}><WebView ref={webRef} source={{ uri: browserUrl }} style={styles.browser} javaScriptEnabled domStorageEnabled allowsFullscreenVideo setSupportMultipleWindows={false} onLoadStart={() => setBrowserLoading(true)} onNavigationStateChange={onBrowserNavigation} onMessage={onMessage} injectedJavaScriptBeforeContentLoaded={BROWSER_BRIDGE_JS} onLoadEnd={() => { setBrowserLoading(false); webRef.current?.injectJavaScript(`${BROWSER_BRIDGE_JS}\ntrue;`); }} onFileDownload={onFileDownload} onError={(event) => { setBrowserLoading(false); setUiError(event.nativeEvent.description || "بارگذاری سایت ناموفق بود"); setMode("ui"); }} onHttpError={() => { setBrowserLoading(false); setUiError("سایت پاسخ مناسبی نداد؛ اتصال اینترنت و آدرس سایت را بررسی کنید."); setMode("ui"); }} /><View pointerEvents="none" style={[styles.browserLoader, !browserLoading && styles.hiddenLoader]}><ActivityIndicator size="large" color="#bfe8ff" /></View></View></View></View>;
  if (uiError) return <View style={styles.loader}><Text style={styles.errorTitle}>خطا در باز کردن محیط برنامه</Text><Text style={styles.loaderText}>{uiError}</Text><Pressable style={styles.retry} onPress={() => setUiError(null)}><Text style={styles.retryText}>تلاش دوباره</Text></Pressable></View>;
  return <View style={styles.root}><WebView ref={webRef} source={{ uri: PANEL_URI }} style={styles.browser} originWhitelist={["*"]} javaScriptEnabled domStorageEnabled allowFileAccess allowUniversalAccessFromFileURLs onMessage={onMessage} onLoadEnd={onPanelLoad} onError={(event) => setUiError(event.nativeEvent.description || "بارگذاری رابط برنامه ناموفق بود")} /></View>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: "#f1f1f3" }, browserShell: { flex: 1, backgroundColor: "#0D47A1" }, browserViewport: { flex: 1, backgroundColor: "#0D47A1", position: "relative" }, browser: { flex: 1, backgroundColor: "#0D47A1" }, browserLoader: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", backgroundColor: "#0D47A1" }, hiddenLoader: { opacity: 0 }, headerSafe: { backgroundColor: "#fff" }, nativeHeader: { height: 60, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 12, gap: 8 }, headerButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#f4f7f9", borderWidth: 1, borderColor: "#dfe5ea" }, addressBar: { flex: 1, height: 42, borderRadius: 22, justifyContent: "center" }, addressContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 10 }, addressText: { color: "#fff", fontSize: 14, fontWeight: "800", textAlign: "center" }, loader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f1f1f3", gap: 12, padding: 24 }, loaderText: { color: "#fff", fontSize: 13, textAlign: "center" }, errorTitle: { color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "center" }, retry: { backgroundColor: "#1d8fd0", borderRadius: 22, paddingHorizontal: 26, paddingVertical: 12 }, retryText: { color: "#fff", fontWeight: "700" }, player: { flex: 1, backgroundColor: "#000" }, playerBar: { minHeight: 58, backgroundColor: "#000", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 10 }, close: { width: 40, height: 40, alignItems: "center", justifyContent: "center" }, playerTitle: { flex: 1, color: "#fff", fontSize: 15, fontWeight: "800", textAlign: "right" }, video: { flex: 1, width: "100%" } });
