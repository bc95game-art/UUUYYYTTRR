import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, NativeSyntheticEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type FileDownload, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import * as FileSystem from "expo-file-system/legacy";
import { useVideoPlayer, VideoView } from "expo-video";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { PANEL_HTML } from "@/lib/panel-html";

const SITE = "https://biomaze.ir/";
const OFFLINE_DIR = `${FileSystem.documentDirectory ?? ""}offline/`;
const BROWSER_BRIDGE_JS = `(function(){
  function send(m){if(window.ReactNativeWebView&&window.ReactNativeWebView.postMessage)window.ReactNativeWebView.postMessage(JSON.stringify(m));}
  var seen=window.__mazSeenOffline||(window.__mazSeenOffline={});
  function videoName(name){return String(name||'biomaze-offline-'+Date.now()+'.mp4').replace(/[^\\w\\u0600-\\u06ff.()_-]+/g,'_');}
  function looksVideo(value){return /\\.(mp4|m4v|webm|mov|mkv|3gp|ts|m3u8)(?:[?#].*)?$/i.test(String(value||''));}
  function emitBlob(blob,name,key){
    if(!blob||!blob.size||blob.size<1024||seen[key])return;
    seen[key]=1; var id='blob:'+key, reader=new FileReader();
    reader.onload=function(){var all=String(reader.result||'').split(',')[1]||'', step=220000, total=Math.ceil(all.length/step), safe=videoName(name);
      for(var i=0;i<total;i++)send({type:'offline-chunk',transferId:id,name:safe,mime:blob.type||'video/mp4',index:i,total:total,data:all.slice(i*step,(i+1)*step)});
      send({type:'offline-complete',transferId:id,name:safe,mime:blob.type||'video/mp4',total:total});};
    reader.readAsDataURL(blob);
  }
  function fetchValue(value,name){var s=String(value||''); if(/^blob:/i.test(s)){fetch(s).then(function(r){return r.blob();}).then(function(b){emitBlob(b,name,s);}).catch(function(){});}
    else if(/^https?:/i.test(s)&&looksVideo(s))send({type:'download-url',url:s,name:videoName(name||s.split('/').pop())});}
  function scanValue(value,name,depth,seenObjects){
    if(value==null||depth>3)return;
    if(typeof Blob!=='undefined'&&value instanceof Blob){emitBlob(value,name,'stored:'+name+':'+value.size);return;}
    if(typeof value==='string'){fetchValue(value,name);return;}
    if(typeof value!=='object')return;
    if(seenObjects.indexOf(value)>=0)return; seenObjects.push(value);
    var label=value.name||value.fileName||value.filename||value.title||name||'video.mp4';
    Object.keys(value).slice(0,40).forEach(function(k){scanValue(value[k],label,depth+1,seenObjects);});
  }
  function scanIndexedDB(){if(!window.indexedDB||!indexedDB.databases)return; indexedDB.databases().then(function(dbs){dbs.forEach(function(info){var req=indexedDB.open(info.name); req.onsuccess=function(){var db=req.result; Array.prototype.slice.call(db.objectStoreNames).forEach(function(storeName){try{var tx=db.transaction(storeName,'readonly'), get=tx.objectStore(storeName).getAll(); get.onsuccess=function(){(get.result||[]).forEach(function(v,i){scanValue(v,storeName+'-'+i+'.mp4',0,[]);});};}catch(e){}});};};}).catch(function(){});}
  function scanCache(){if(!window.caches)return; caches.keys().then(function(keys){keys.forEach(function(k){caches.open(k).then(function(c){return c.keys().then(function(reqs){reqs.forEach(function(req){c.match(req).then(function(r){if(r&&r.blob)r.blob().then(function(b){if((b.type||'').indexOf('video')>=0||looksVideo(req.url))emitBlob(b,videoName(req.url.split('/').pop()),'cache:'+req.url);});});});});}).catch(function(){});});}).catch(function(){});}
  document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[download]'):null;if(a&&a.href)send({type:'download-url',url:a.href,name:a.getAttribute('download')||''});setTimeout(function(){scanIndexedDB();scanCache();},1200);},true);
  setTimeout(function(){scanIndexedDB();scanCache();},900);
})(); true;`;
const PANEL_FALLBACK_JS = `(function(){
  function send(m){if(window.ReactNativeWebView&&window.ReactNativeWebView.postMessage)window.ReactNativeWebView.postMessage(JSON.stringify(m));}
  function go(page){
    var pages=document.querySelectorAll('.page'); for(var i=0;i<pages.length;i++) pages[i].classList.toggle('active',pages[i].id===page);
    var tabs=document.querySelectorAll('.tab'); for(var j=0;j<tabs.length;j++) tabs[j].classList.toggle('active',tabs[j].getAttribute('data-page')===page);
    var track=document.getElementById('track'), tab=document.querySelector('.tab[data-page="'+page+'"]');
    if(track&&tab) track.style.setProperty('--i',tab.getAttribute('data-i'));
    var screen=document.getElementById('screen'); if(screen) screen.scrollTop=0;
  }
  var tabs=document.querySelectorAll('.tab,#bell'); for(var k=0;k<tabs.length;k++) tabs[k].onclick=function(e){if(e)e.preventDefault();go(this.getAttribute('data-page'));};
  var open=document.getElementById('openSiteBtn'), reload=document.getElementById('reloadBtn');
  if(open) open.onclick=function(){send({type:'open-site',url:'${SITE}'});};
  if(reload) reload.onclick=function(){send({type:'open-site',url:'${SITE}'});};
  var back=document.getElementById('backBtn'); if(back) back.onclick=function(){if(window.history)window.history.back();};
})(); true;`;
type OfflineFile = { id: number; uri: string; name: string; size: number; date: string };
type Mode = "ui" | "browser" | "player";

function NativePlayer({ file, onClose }: { file: OfflineFile; onClose: () => void }) {
  const player = useVideoPlayer(file.uri, (p) => { p.play(); });
  return <View style={styles.player}><SafeAreaView edges={["top"]} style={styles.playerBar}><Pressable onPress={onClose} style={styles.close}><MaterialIcons name="arrow-forward" size={24} color="#fff" /></Pressable><Text style={styles.playerTitle} numberOfLines={1}>{file.name}</Text></SafeAreaView><VideoView player={player} style={styles.video} nativeControls /></View>;
}

export default function HomeScreen() {
  const webRef = useRef<WebView>(null);
  const [mode, setMode] = useState<Mode>("ui");
  const [browserUrl, setBrowserUrl] = useState(SITE);
  const [browserTitle, setBrowserTitle] = useState("biomaze.ir");
  const [browserCanGoBack, setBrowserCanGoBack] = useState(false);
  const [files, setFiles] = useState<OfflineFile[]>([]);
  const [activeFile, setActiveFile] = useState<OfflineFile | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);
  const transfers = useRef<Record<string, { name: string; mime: string; total: number; chunks: string[] }>>({});

  const readFiles = useCallback(async () => {
    if (!FileSystem.documentDirectory) return [] as OfflineFile[];
    await FileSystem.makeDirectoryAsync(OFFLINE_DIR, { intermediates: true }).catch(() => undefined);
    const names = await FileSystem.readDirectoryAsync(OFFLINE_DIR).catch(() => [] as string[]);
    const output: OfflineFile[] = [];
    const videoPattern = /\.(mp4|m4v|webm|mov|mkv|3gp|ts|m3u8)$/i;
    for (const name of names.filter((x) => !x.startsWith(".") && videoPattern.test(x))) {
      const uri = `${OFFLINE_DIR}${name}`;
      const info = await FileSystem.getInfoAsync(uri).catch(() => ({ exists: false }));
      if (!info.exists || ("isDirectory" in info && info.isDirectory)) continue;
      const bytes = "size" in info && typeof info.size === "number" ? info.size : 0;
      output.push({ id: output.length + 1, uri, name, size: Math.max(0, Math.round(bytes / 1024 / 1024)), date: "ذخیره‌شده در این برنامه" });
    }
    return output;
  }, []);

  const refreshFiles = useCallback(async () => {
    const latest = await readFiles();
    setFiles(latest);
    return latest;
  }, [readFiles]);

  useEffect(() => {
    let cancelled = false;
    void readFiles().then((latest) => { if (!cancelled) setFiles(latest); });
    return () => { cancelled = true; };
  }, [readFiles]);
  useEffect(() => { const sub = BackHandler.addEventListener("hardwareBackPress", () => { if (mode === "player") { setMode("ui"); return true; } if (mode === "browser" && browserCanGoBack) { webRef.current?.goBack(); return true; } if (mode === "browser") { setMode("ui"); return true; } return false; }); return () => sub.remove(); }, [mode, browserCanGoBack]);

  const pushFilesToPanel = useCallback((list: OfflineFile[]) => {
    webRef.current?.injectJavaScript(`window.receiveFiles(${JSON.stringify(list.map(({ id, name, size, date }) => ({ id, name, size, date })))}); true;`);
  }, []);
  const sendFiles = useCallback(async () => {
    const latest = await refreshFiles();
    pushFilesToPanel(latest);
  }, [pushFilesToPanel, refreshFiles]);
  const onPanelLoad = useCallback(() => {
    webRef.current?.injectJavaScript(PANEL_FALLBACK_JS);
    void sendFiles();
  }, [sendFiles]);

  const downloadVideo = useCallback(async (url: string, nameHint?: string) => {
    if (!url || !FileSystem.documentDirectory) return;
    await FileSystem.makeDirectoryAsync(OFFLINE_DIR, { intermediates: true }).catch(() => undefined);
    let raw = nameHint || url.split("?")[0].split("/").pop() || `biomaze-${Date.now()}.mp4`;
    try { raw = decodeURIComponent(raw); } catch { /* نام رمزگذاری‌شدهٔ خراب را پاک‌سازی می‌کنیم */ }
    let clean = raw.replace(/[^\p{L}\p{N}._-]/gu, "_") || `biomaze-${Date.now()}.mp4`;
    if (!/\.(mp4|m4v|webm|mov|mkv|3gp|ts|m3u8)$/i.test(clean)) clean += ".mp4";
    const existing = await FileSystem.readDirectoryAsync(OFFLINE_DIR).catch(() => [] as string[]);
    const extension = clean.match(/\.[^.]+$/)?.[0] ?? ".mp4";
    const stem = clean.slice(0, -extension.length);
    let candidate = clean;
    let suffix = 1;
    while (existing.includes(candidate)) candidate = `${stem} (${suffix++})${extension}`;
    const target = `${OFFLINE_DIR}${candidate}`;
    await FileSystem.downloadAsync(url, target).then(async () => {
      const info = await FileSystem.getInfoAsync(target).catch(() => ({ exists: false }));
      if (!info.exists || !("size" in info) || !info.size) throw new Error("empty download");
      const latest = await refreshFiles();
      pushFilesToPanel(latest);
    }).catch(() => setUiError("دانلود ویدئو انجام نشد. اتصال یا دسترسی فایل را بررسی کنید."));
  }, [pushFilesToPanel, refreshFiles]);

  const onMessage = useCallback(async (event: WebViewMessageEvent) => {
    let message: { type?: string; url?: string; id?: number; name?: string; mime?: string; transferId?: string; index?: number; total?: number; data?: string } = {};
    try { message = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (message.type === "open-site") { setBrowserUrl(message.url || SITE); setMode("browser"); return; }
    if (message.type === "download-url" && message.url) { await downloadVideo(message.url, message.name); return; }
    if (message.type === "offline-chunk" && message.transferId && typeof message.index === "number" && message.data) {
      const current = transfers.current[message.transferId] || { name: message.name || "biomaze-offline.mp4", mime: message.mime || "video/mp4", total: message.total || 0, chunks: [] };
      current.chunks[message.index] = message.data; current.total = message.total || current.total; transfers.current[message.transferId] = current; return;
    }
    if (message.type === "offline-complete" && message.transferId) {
      const current = transfers.current[message.transferId];
      if (current && current.total > 0 && current.chunks.filter(Boolean).length === current.total) {
        await FileSystem.makeDirectoryAsync(OFFLINE_DIR, { intermediates: true }).catch(() => undefined);
        const clean = (current.name || "biomaze-offline.mp4").replace(/[^\p{L}\p{N}._()-]/gu, "_");
        const target = `${OFFLINE_DIR}${clean || "biomaze-offline.mp4"}`;
        await FileSystem.writeAsStringAsync(target, current.chunks.join(""), { encoding: FileSystem.EncodingType.Base64 }).then(async () => { const latest = await refreshFiles(); pushFilesToPanel(latest); }).catch(() => setUiError("ذخیرهٔ ویدئوی آفلاین سایت انجام نشد."));
        delete transfers.current[message.transferId];
      }
      return;
    }
    if (message.type === "list-files") { await sendFiles(); return; }
    if (message.type === "open-file" && message.id) { const file = files.find((x) => x.id === message.id); if (file) { setActiveFile(file); setMode("player"); } return; }
    if (message.type === "delete-file" && message.id) { const file = files.find((x) => x.id === message.id); if (file) await FileSystem.deleteAsync(file.uri, { idempotent: true }); await sendFiles(); return; }
    if (message.type === "rename-file" && message.id && message.name?.trim()) { const file = files.find((x) => x.id === message.id); if (file) { const typed = message.name.trim().replace(/[\\/:*?"<>|]/g, "_"); const oldExt = file.name.match(/\.[^.]+$/)?.[0] ?? ".mp4"; const safe = /\.[A-Za-z0-9]{2,5}$/.test(typed) ? typed : `${typed}${oldExt}`; await FileSystem.moveAsync({ from: file.uri, to: `${OFFLINE_DIR}${safe}` }).catch(() => undefined); } await sendFiles(); return; }
  }, [downloadVideo, files, pushFilesToPanel, refreshFiles, sendFiles]);

  const onBrowserNavigation = (nav: WebViewNavigation) => { setBrowserCanGoBack(nav.canGoBack); setBrowserTitle(nav.title || nav.url.replace(/^https?:\/\//, "").split("/")[0]); };
  const onFileDownload = useCallback(async (event: NativeSyntheticEvent<FileDownload>) => {
    await downloadVideo(event.nativeEvent.downloadUrl);
  }, [downloadVideo]);

  const address = (browserUrl.replace(/^https?:\/\//, "").split("/")[0] || browserTitle || "biomaze.ir").toLowerCase();
  const header = <SafeAreaView edges={["top"]} style={styles.nativeHeader}><Pressable onPress={() => setMode("ui")} style={styles.headerButton}><MaterialIcons name="arrow-back" size={25} color="#18212b" /></Pressable><View style={styles.addressBar}><View style={styles.addressTeal} /><View style={styles.addressBlue} /><View style={styles.addressPink} /><View style={styles.addressContent}><MaterialIcons name="lock" size={21} color="#fff" /><Text style={styles.addressText} numberOfLines={1}>{address}</Text></View></View><Pressable onPress={() => webRef.current?.reload()} style={styles.headerButton}><MaterialIcons name="refresh" size={24} color="#18212b" /></Pressable></SafeAreaView>;
  if (mode === "player" && activeFile) return <NativePlayer file={activeFile} onClose={() => setMode("ui")} />;
  if (mode === "browser") return <View style={styles.root}>{header}<WebView ref={webRef} source={{ uri: browserUrl }} style={styles.browser} javaScriptEnabled domStorageEnabled allowsFullscreenVideo setSupportMultipleWindows={false} onNavigationStateChange={onBrowserNavigation} onMessage={onMessage} injectedJavaScriptBeforeContentLoaded={BROWSER_BRIDGE_JS} onLoadEnd={() => webRef.current?.injectJavaScript(BROWSER_BRIDGE_JS)} onFileDownload={onFileDownload} onError={(event) => { setUiError(event.nativeEvent.description || "بارگذاری سایت ناموفق بود"); setMode("ui"); }} onHttpError={() => { setUiError("سایت پاسخ مناسبی نداد؛ اتصال اینترنت و آدرس سایت را بررسی کنید."); setMode("ui"); }} startInLoadingState renderLoading={() => <View style={styles.loader}><ActivityIndicator size="large" color="#1d8fd0" /></View>} /></View>;
  if (uiError) return <View style={styles.loader}><Text style={styles.errorTitle}>خطا در باز کردن محیط برنامه</Text><Text style={styles.loaderText}>{uiError}</Text><Pressable style={styles.retry} onPress={() => setUiError(null)}><Text style={styles.retryText}>تلاش دوباره</Text></Pressable></View>;
  return <View style={styles.root}><WebView ref={webRef} source={{ html: PANEL_HTML, baseUrl: SITE }} style={styles.browser} originWhitelist={["*"]} javaScriptEnabled domStorageEnabled allowFileAccess onMessage={onMessage} onLoadEnd={onPanelLoad} onError={(event) => setUiError(event.nativeEvent.description || "بارگذاری رابط برنامه ناموفق بود")}/></View>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: "#0d1620" }, browser: { flex: 1, backgroundColor: "#0d1620" }, nativeHeader: { height: 60, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 8, gap: 8 }, headerButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#f4f7f9", borderWidth: 1, borderColor: "#dfe5ea" }, addressBar: { flex: 1, height: 42, borderRadius: 24, overflow: "hidden", position: "relative", justifyContent: "center" }, addressTeal: { position: "absolute", left: 0, top: 0, bottom: 0, width: "38%", backgroundColor: "#0b9d9a" }, addressBlue: { position: "absolute", left: "25%", top: 0, bottom: 0, width: "50%", backgroundColor: "#176dcc", opacity: 0.98 }, addressPink: { position: "absolute", right: 0, top: 0, bottom: 0, width: "42%", backgroundColor: "#d53182", opacity: 0.96 }, addressContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 10 }, addressText: { color: "#fff", fontSize: 14.5, fontWeight: "800", textAlign: "center" }, loader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0d1620", gap: 12, padding: 24 }, loaderText: { color: "#fff", fontSize: 13, textAlign: "center" }, errorTitle: { color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "center" }, retry: { backgroundColor: "#1d8fd0", borderRadius: 22, paddingHorizontal: 26, paddingVertical: 12 }, retryText: { color: "#fff", fontWeight: "700" }, player: { flex: 1, backgroundColor: "#000" }, playerBar: { minHeight: 58, backgroundColor: "#000", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 10 }, close: { width: 40, height: 40, alignItems: "center", justifyContent: "center" }, playerTitle: { flex: 1, color: "#fff", fontSize: 15, fontWeight: "800", textAlign: "right" }, video: { flex: 1, width: "100%" } });
