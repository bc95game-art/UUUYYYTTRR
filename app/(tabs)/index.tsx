import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, NativeSyntheticEvent, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type FileDownload, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import * as FileSystem from "expo-file-system/legacy";
import { useVideoPlayer, VideoView } from "expo-video";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import { strToU8, zipSync } from "fflate";

const SITE = "https://biomaze.ir/";
const PANEL_URI = "file:///android_asset/panel-5.html";
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
  function scanBinary(value,name){try{if(value instanceof ArrayBuffer)emitBlob(new Blob([value],{type:'video/mp4'}),name,'array:'+name+':'+value.byteLength);else if(ArrayBuffer.isView&&ArrayBuffer.isView(value))emitBlob(new Blob([value.buffer],{type:'video/mp4'}),name,'view:'+name+':'+value.byteLength);}catch(e){}}
  function fetchValue(value,name){var s=String(value||''); if(/^blob:/i.test(s)){fetch(s).then(function(r){return r.blob();}).then(function(b){emitBlob(b,name,s);}).catch(function(){});}
    else if(/^https?:/i.test(s)&&looksVideo(s))send({type:'download-url',url:s,name:videoName(name||s.split('/').pop())});}
  function scanValue(value,name,depth,seenObjects){
    if(value==null||depth>3)return;
    if(typeof Blob!=='undefined'&&value instanceof Blob){emitBlob(value,name,'stored:'+name+':'+value.size);return;}
    if(typeof ArrayBuffer!=='undefined'&&(value instanceof ArrayBuffer||(ArrayBuffer.isView&&ArrayBuffer.isView(value)))){scanBinary(value,name);return;}
    if(typeof value==='string'){fetchValue(value,name);return;}
    if(typeof value!=='object')return;
    if(seenObjects.indexOf(value)>=0)return; seenObjects.push(value);
    var label=value.name||value.fileName||value.filename||value.title||name||'video.mp4';
    Object.keys(value).slice(0,40).forEach(function(k){scanValue(value[k],label,depth+1,seenObjects);});
  }
  function scanIndexedDB(){if(!window.indexedDB||!indexedDB.databases)return; indexedDB.databases().then(function(dbs){dbs.forEach(function(info){var req=indexedDB.open(info.name); req.onsuccess=function(){var db=req.result; Array.prototype.slice.call(db.objectStoreNames).forEach(function(storeName){try{var tx=db.transaction(storeName,'readonly'), get=tx.objectStore(storeName).getAll(); get.onsuccess=function(){(get.result||[]).forEach(function(v,i){scanValue(v,storeName+'-'+i+'.mp4',0,[]);});};}catch(e){}});};};}).catch(function(){});}
  function scanCache(){if(!window.caches)return; caches.keys().then(function(keys){keys.forEach(function(k){caches.open(k).then(function(c){return c.keys().then(function(reqs){reqs.forEach(function(req){c.match(req).then(function(r){if(r&&r.blob)r.blob().then(function(b){if((b.type||'').indexOf('video')>=0||looksVideo(req.url))emitBlob(b,videoName(req.url.split('/').pop()),'cache:'+req.url);});});});});}).catch(function(){});});}).catch(function(){});}
  document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[download]'):null;if(a&&a.href)send({type:'download-url',url:a.href,name:a.getAttribute('download')||''});setTimeout(function(){scanIndexedDB();scanCache();},1200);},true);
  function scanAll(){scanIndexedDB();scanCache();}
  window.__mazCollectOfflineReport=function(){
    var report={generatedAt:new Date().toISOString(),status:'partial-or-complete',page:{url:location.href,title:document.title,readyState:document.readyState},storage:{indexedDB:[],cache:[],serviceWorkers:[],localStorage:[],sessionStorage:[]},media:{elements:[],performance:[]},capabilities:{indexedDB:!!window.indexedDB,caches:!!window.caches,serviceWorker:!!navigator.serviceWorker,opfs:!!(navigator.storage&&navigator.storage.getDirectory),storageEstimate:!!(navigator.storage&&navigator.storage.estimate)},methodErrors:[]};
    var sent=false, cancelled=false, done=0, total=31, extractedBytes=0;
    report.probes=[];
    function progress(method, status, value){if(cancelled)return;done=Math.min(total,done+1);var text='';try{text=JSON.stringify(value||'')}catch(e){text=''}extractedBytes+=text.length;report.probes.push({method:method,status:status||'ok',bytes:text.length});send({type:'offline-report-progress',total:total,done:done,bytes:extractedBytes,method:method})}
    window.__mazStopOfflineReport=function(){cancelled=true;report.status='stopped-by-user';report.methodErrors.push({method:'collector',error:'stopped-by-user'});finish()};
    function finish(){if(sent)return;sent=true;report.completedAt=new Date().toISOString();send({type:'offline-report-result',report:JSON.stringify(report,null,2)})}
    function timeout(p,ms,label){return Promise.race([p,new Promise(function(resolve){setTimeout(function(){report.methodErrors.push({method:label,error:'method-timeout'});resolve(null)},ms)})]).catch(function(e){report.methodErrors.push({method:label,error:String(e&&e.message||e)});return null})}
    function collectIndexedDB(){progress('IndexedDB: فهرست پایگاه‌ها');if(!window.indexedDB||!indexedDB.databases){progress('IndexedDB: قابلیت API','unavailable');return Promise.resolve(null);}return timeout(indexedDB.databases().then(function(dbs){return Promise.all((dbs||[]).map(function(info){return timeout(new Promise(function(resolve){var item={name:info.name||'',version:info.version||0,stores:[]},req=indexedDB.open(info.name);req.onerror=function(){item.error='open-failed';resolve(item)};req.onsuccess=function(){var db=req.result;Array.prototype.forEach.call(db.objectStoreNames,function(n){var st={name:n};try{var os=db.transaction(n,'readonly').objectStore(n);st.keyPath=os.keyPath;st.autoIncrement=os.autoIncrement;var c=os.count();c.onsuccess=function(){st.count=c.result};}catch(e){st.error=String(e&&e.message||e)}item.stores.push(st)});resolve(item)}}),5000,'indexeddb:'+info.name)}))}),7000,'indexeddb-list')}
    function collectCache(){progress('Cache API: فهرست cacheها');if(!window.caches){progress('Cache API: قابلیت API','unavailable');return Promise.resolve(null);}return timeout(caches.keys().then(function(keys){return Promise.all((keys||[]).map(function(k){return timeout(caches.open(k).then(function(c){return c.keys().then(function(reqs){return Promise.all((reqs||[]).slice(0,500).map(function(req){return c.match(req).then(function(r){return {url:req.url,method:req.method,status:r&&r.status||0,mime:r&&r.headers.get('content-type')||'',length:r&&r.headers.get('content-length')||''}}).catch(function(e){return {url:req.url,error:String(e&&e.message||'cache-read-failed')}})})).then(function(entries){return {name:k,entries:entries}})})}),7000,'cache:'+k)}))}),10000,'cache-list')}
    function collectServiceWorkers(){progress('Service Worker: registrationها');if(!navigator.serviceWorker||!navigator.serviceWorker.getRegistrations){progress('Service Worker: قابلیت API','unavailable');return Promise.resolve(null);}return timeout(navigator.serviceWorker.getRegistrations().then(function(rs){return (rs||[]).map(function(r){return {scope:r.scope,active:r.active&&r.active.scriptURL,waiting:r.waiting&&r.waiting.scriptURL,installing:r.installing&&r.installing.scriptURL}})}),5000,'service-workers')}
    function collectEstimate(){progress('StorageManager: estimate و persisted');if(!navigator.storage){progress('StorageManager: قابلیت API','unavailable');return Promise.resolve(null);}return timeout(Promise.all([navigator.storage.estimate?navigator.storage.estimate():Promise.resolve(null),navigator.storage.persisted?navigator.storage.persisted():Promise.resolve(null)]),5000,'storage-estimate').then(function(x){if(x){report.capabilities.estimate=x[0];report.capabilities.persisted=x[1]}return x})}
    function collectSync(){
      function p(n,v){progress(n,'ok',v);return v}
      try{var st=window.localStorage;report.storage.localStorage=Object.keys(st).map(function(n){return {key:n,length:(st.getItem(n)||'').length}});p('localStorage: کلیدها',report.storage.localStorage)}catch(e){report.methodErrors.push({method:'localStorage',error:String(e&&e.message||e)});p('localStorage: دسترسی','error')}
      try{var ss=window.sessionStorage;report.storage.sessionStorage=Object.keys(ss).map(function(n){return {key:n,length:(ss.getItem(n)||'').length}});p('sessionStorage: کلیدها',report.storage.sessionStorage)}catch(e){report.methodErrors.push({method:'sessionStorage',error:String(e&&e.message||e)});p('sessionStorage: دسترسی','error')}
      try{report.media.elements=Array.prototype.map.call(document.querySelectorAll('video,audio,source'),function(el){return {tag:el.tagName,src:el.currentSrc||el.src||el.getAttribute('src')||'',type:el.getAttribute('type')||'',duration:el.duration||null,readyState:el.readyState||0,networkState:el.networkState||0}});p('Media: video/audio/source',report.media.elements)}catch(e){p('Media: عناصر','error')}
      try{report.media.performance=performance.getEntriesByType('resource').filter(function(e){return /video|\.mp4|\.m3u8|\.webm|\.m4s|\.ts|blob:/i.test(e.name)}).slice(-500).map(function(e){return {name:e.name,initiatorType:e.initiatorType||'',duration:e.duration||0,transferSize:e.transferSize||0,encodedBodySize:e.encodedBodySize||0}});p('Performance: منابع ویدئو',report.media.performance)}catch(e){p('Performance: منابع','error')}
      p('Document: cookieهای قابل مشاهده',document.cookie||'');p('Navigator: storage API',!!navigator.storage);p('Navigator: IndexedDB API',!!window.indexedDB);p('Navigator: Cache API',!!window.caches);p('Navigator: Service Worker API',!!navigator.serviceWorker);p('Navigator: OPFS API',!!(navigator.storage&&navigator.storage.getDirectory));p('Navigator: Storage estimate',!!(navigator.storage&&navigator.storage.estimate));p('Navigator: Storage persisted',!!(navigator.storage&&navigator.storage.persisted));p('Navigator: Permissions API',!!navigator.permissions);p('Navigator: connection metadata',navigator.connection||null);p('Performance: navigation timing',performance.getEntriesByType('navigation'));p('Performance: resource timing count',performance.getEntriesByType('resource').length);p('Service Worker: controller',navigator.serviceWorker&&navigator.serviceWorker.controller&&navigator.serviceWorker.controller.scriptURL||null);p('Web Locks API',!!navigator.locks);p('File System Access API',!!window.showOpenFilePicker);p('Clipboard API',!!navigator.clipboard);p('BroadcastChannel API',!!window.BroadcastChannel);p('WebCrypto API',!!window.crypto);
    }
    collectSync();
    Promise.all([collectIndexedDB().then(function(x){if(x!==null){report.storage.indexedDB=x;progress('IndexedDB: نتیجه','ok',x)}}),collectCache().then(function(x){if(x!==null){report.storage.cache=x;progress('Cache API: نتیجه','ok',x)}}),collectServiceWorkers().then(function(x){if(x!==null){report.storage.serviceWorkers=x;progress('Service Worker: نتیجه','ok',x)}}),collectEstimate()]).then(finish).catch(function(e){report.methodErrors.push({method:'collector-finalize',error:String(e&&e.message||e)});finish()});
    setTimeout(finish,12000);
  };
  window.__mazStartOfflineReport=function(){if(window.__mazReportStarted)return;window.__mazReportStarted=true;try{window.__mazCollectOfflineReport()}catch(e){send({type:'offline-report-result',report:JSON.stringify({generatedAt:new Date().toISOString(),error:'collector-start-failed',message:String(e&&e.message||e),page:{url:location.href,title:document.title,origin:location.origin}})})}};
  send({type:'offline-report-ready',href:location.href,title:document.title,origin:location.origin});
  setTimeout(scanAll,900);
  setInterval(scanAll,5000);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)scanAll();});
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
  const browserUrlRef = useRef(SITE);
  const [browserTitle, setBrowserTitle] = useState("biomaze.ir");
  const [browserCanGoBack, setBrowserCanGoBack] = useState(false);
  const [files, setFiles] = useState<OfflineFile[]>([]);
  const [activeFile, setActiveFile] = useState<OfflineFile | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [isReportRunning, setIsReportRunning] = useState(false);
  const [reportProgress, setReportProgress] = useState({ total: 31, done: 0, bytes: 0, method: "آماده‌سازی" });
  const reportRequested = useRef(false);
  const reportStartSent = useRef(false);
  const reportPageRef = useRef("");
  const reportForPanel = useRef<{ report: string; name: string } | null>(null);
  const reportErrorForPanel = useRef<string | null>(null);
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
  useEffect(() => { const sub = BackHandler.addEventListener("hardwareBackPress", () => { if (mode === "player") { setMode("ui"); return true; } if (mode === "browser" && reportRequested.current) return true; if (mode === "browser" && browserCanGoBack) { webRef.current?.goBack(); return true; } if (mode === "browser") { setMode("ui"); return true; } return false; }); return () => sub.remove(); }, [mode, browserCanGoBack]);

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
    const pending = reportForPanel.current;
    if (pending) {
      reportForPanel.current = null;
      webRef.current?.injectJavaScript(`window.receiveReportReady && window.receiveReportReady(${JSON.stringify(pending.report)},${JSON.stringify(pending.name)}); true;`);
    }
    const reportError = reportErrorForPanel.current;
    if (reportError) {
      reportErrorForPanel.current = null;
      webRef.current?.injectJavaScript(`window.receiveReportError && window.receiveReportError(${JSON.stringify(reportError)}); true;`);
    }
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

  const toBase64 = (bytes: Uint8Array) => {
    let binary = "";
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + step, bytes.length)));
    return btoa(binary);
  };
  const reportZipBytes = (report: string) => {
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(report); } catch { parsed = { raw: report }; }
    const files: Record<string, Uint8Array> = {
      "README-fa.txt": strToU8("این بسته فقط شامل داده‌های واقعی بازگردانده‌شده از WebView سایت biomaze.ir است. هر روش ناموفق با خطای واقعی خودش ثبت شده و دادهٔ حدسی اضافه نشده است.\n"),
      "report.json": strToU8(JSON.stringify(parsed, null, 2)),
      "summary.txt": strToU8(JSON.stringify({ generatedAt: parsed.generatedAt, page: parsed.page, capabilities: parsed.capabilities, methodStatus: { indexedDB: Array.isArray((parsed.storage as any)?.indexedDB) ? "collected" : "failed-or-unavailable", cache: Array.isArray((parsed.storage as any)?.cache) ? "collected" : "failed-or-unavailable", serviceWorkers: Array.isArray((parsed.storage as any)?.serviceWorkers) ? "collected" : "failed-or-unavailable", localStorage: Array.isArray((parsed.storage as any)?.localStorage) ? "collected" : "failed-or-unavailable", sessionStorage: Array.isArray((parsed.storage as any)?.sessionStorage) ? "collected" : "failed-or-unavailable", media: Array.isArray((parsed.media as any)?.elements) ? "collected" : "failed-or-unavailable", performance: Array.isArray((parsed.media as any)?.performance) ? "collected" : "failed-or-unavailable" } }, null, 2)),
    };
    const storage = (parsed.storage || {}) as Record<string, unknown>;
    const media = (parsed.media || {}) as Record<string, unknown>;
    for (const [name, value] of Object.entries({
      "indexeddb.json": storage.indexedDB,
      "cache-api.json": storage.cache,
      "service-workers.json": storage.serviceWorkers,
      "local-storage.json": storage.localStorage,
      "session-storage.json": storage.sessionStorage,
      "media-elements.json": media.elements,
      "performance-resources.json": media.performance,
    })) files[`sources/${name}`] = strToU8(JSON.stringify(value ?? { error: "unavailable" }, null, 2));
    return zipSync(files, { level: 6 });
  };
  const onMessage = useCallback(async (event: WebViewMessageEvent) => {
    let message: { type?: string; url?: string; id?: number; name?: string; mime?: string; transferId?: string; index?: number; total?: number; data?: string; report?: string; done?: number; bytes?: number; method?: string; href?: string; origin?: string; title?: string } = {};
    try { message = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (message.type === "open-site") { const nextUrl = message.url || SITE; browserUrlRef.current = nextUrl; setBrowserUrl(nextUrl); setMode("browser"); return; }
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
    if (message.type === "offline-report-ready") {
      if (reportRequested.current && !reportStartSent.current) {
        reportStartSent.current = true;
        reportPageRef.current = message.href || browserUrlRef.current || SITE;
        setReportProgress({ total: 31, done: 0, bytes: 0, method: "صفحه آماده شد؛ شروع استخراج از همان صفحه" });
        webRef.current?.injectJavaScript("try { if (window.__mazStartOfflineReport) window.__mazStartOfflineReport(); } catch (_) {} true;");
      }
      return;
    }
    if (message.type === "offline-report-progress") {
      setReportProgress({ total: message.total || 24, done: message.done || 0, bytes: message.bytes || 0, method: message.method || "در حال بررسی" });
      return;
    }
    if (message.type === "offline-report-stop") {
      reportStartSent.current = false;
      webRef.current?.injectJavaScript("try { window.__mazStopOfflineReport && window.__mazStopOfflineReport(); } catch (_) {} true;");
      return;
    }
    if (message.type === "offline-report-request") {
      reportRequested.current = true; reportStartSent.current = false; reportPageRef.current = ""; setIsReportRunning(true); setReportProgress({ total: 31, done: 0, bytes: 0, method: "اتصال به صفحهٔ فعلی سایت" }); const currentUrl = browserUrlRef.current || SITE; setBrowserUrl(currentUrl); setMode("browser");
      setTimeout(() => { if (reportRequested.current) { reportRequested.current = false; setIsReportRunning(false); reportErrorForPanel.current = "استخراج گزارش از حافظهٔ سایت در مهلت تعیین‌شده کامل نشد؛ هیچ گزارش ساختگی ایجاد نشد. دوباره تلاش کنید."; setMode("ui"); } }, 45000);
      return;
    }
    if (message.type === "offline-report-result" && message.report) {
      let parsed: { error?: string; message?: string } = {};
      try { parsed = JSON.parse(message.report); } catch { parsed = { error: "invalid-report", message: "گزارش دریافتی معتبر نبود." }; }
      if (parsed.error) {
        reportRequested.current = false; reportStartSent.current = false; setIsReportRunning(false);
        reportErrorForPanel.current = parsed.message || "استخراج گزارش واقعی ناموفق بود.";
        setMode("ui");
        return;
      }
      const reportName = `mazvideo-offline-report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      reportForPanel.current = { report: message.report, name: reportName };
      reportRequested.current = false; reportStartSent.current = false; setIsReportRunning(false); setMode("ui");
      return;
    }
    if (message.type === "share-report" && message.report && FileSystem.documentDirectory) {
      const zipName = (message.name || `mazvideo-offline-report-${Date.now()}.zip`).replace(/\.json$/i, ".zip");
      const zipUri = `${OFFLINE_DIR}${zipName}`;
      await FileSystem.makeDirectoryAsync(OFFLINE_DIR, { intermediates: true }).catch(() => undefined);
      await FileSystem.writeAsStringAsync(zipUri, toBase64(reportZipBytes(message.report)), { encoding: FileSystem.EncodingType.Base64 }).then(() => Share.share({ title: "گزارش ZIP ذخیره‌سازی آفلاین ماز ویدیو", message: "گزارش چندمنبعی ZIP آماده است.", url: zipUri })).catch(() => undefined);
      return;
    }
    if (message.type === "save-report" && message.report && FileSystem.documentDirectory) {
      const reportName = (message.name || `mazvideo-offline-report-${Date.now()}.zip`).replace(/\.json$/i, ".zip");
      await FileSystem.makeDirectoryAsync(OFFLINE_DIR, { intermediates: true }).catch(() => undefined);
      await FileSystem.writeAsStringAsync(`${OFFLINE_DIR}${reportName}`, toBase64(reportZipBytes(message.report)), { encoding: FileSystem.EncodingType.Base64 }).then(() => webRef.current?.injectJavaScript(`window.receiveReportSaved && window.receiveReportSaved(${JSON.stringify(reportName)}); true;`)).catch(() => undefined);
      return;
    }
    if (message.type === "list-files") { await sendFiles(); return; }
    if (message.type === "open-file" && message.id) { const file = files.find((x) => x.id === message.id); if (file) { setActiveFile(file); setMode("player"); } return; }
    if (message.type === "delete-file" && message.id) { const file = files.find((x) => x.id === message.id); if (file) await FileSystem.deleteAsync(file.uri, { idempotent: true }); await sendFiles(); return; }
    if (message.type === "rename-file" && message.id && message.name?.trim()) { const file = files.find((x) => x.id === message.id); if (file) { const typed = message.name.trim().replace(/[\\/:*?"<>|]/g, "_"); const oldExt = file.name.match(/\.[^.]+$/)?.[0] ?? ".mp4"; const safe = /\.[A-Za-z0-9]{2,5}$/.test(typed) ? typed : `${typed}${oldExt}`; await FileSystem.moveAsync({ from: file.uri, to: `${OFFLINE_DIR}${safe}` }).catch(() => undefined); } await sendFiles(); return; }
  }, [downloadVideo, files, pushFilesToPanel, refreshFiles, sendFiles]);

  const onBrowserNavigation = (nav: WebViewNavigation) => { const next = nav.url || browserUrlRef.current; if (reportRequested.current && reportStartSent.current && reportPageRef.current && next !== reportPageRef.current) { reportStartSent.current = false; setReportProgress({ total: 31, done: 0, bytes: 0, method: "صفحه تغییر کرد؛ آماده‌سازی صفحهٔ جدید" }); } browserUrlRef.current = next; setBrowserUrl(next); setBrowserCanGoBack(nav.canGoBack); setBrowserTitle(nav.title || next.replace(/^https?:\/\//, "").split("/")[0]); };
  const onFileDownload = useCallback(async (event: NativeSyntheticEvent<FileDownload>) => {
    await downloadVideo(event.nativeEvent.downloadUrl);
  }, [downloadVideo]);

  const address = (browserUrl.replace(/^https?:\/\//, "").split("/")[0] || browserTitle || "biomaze.ir").toLowerCase();
  const header = <SafeAreaView edges={["top"]} style={styles.headerSafe}><View style={styles.nativeHeader}><Pressable disabled={isReportRunning} onPress={() => { if (!isReportRunning) setMode("ui"); }} style={[styles.headerButton, isReportRunning && styles.disabledButton]}><MaterialIcons name="arrow-back" size={23} color="#18212b" /></Pressable><LinearGradient colors={["#14897F", "#3388FF", "#7B5CF0", "#E8557A"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.addressBar}><View style={styles.addressContent}><MaterialIcons name="lock" size={19} color="#fff" /><Text style={styles.addressText} numberOfLines={1}>{isReportRunning ? "در حال استخراج گزارش…" : address}</Text></View></LinearGradient><Pressable disabled={isReportRunning} onPress={() => webRef.current?.reload()} style={[styles.headerButton, isReportRunning && styles.disabledButton]}><MaterialIcons name="refresh" size={22} color="#18212b" /></Pressable></View></SafeAreaView>;
  if (mode === "player" && activeFile) return <NativePlayer file={activeFile} onClose={() => setMode("ui")} />;
  if (mode === "browser") return <View style={styles.root}><View style={styles.browserShell}>{header}<View style={styles.browserViewport}><WebView ref={webRef} source={{ uri: browserUrl }} style={styles.browser} javaScriptEnabled domStorageEnabled allowsFullscreenVideo setSupportMultipleWindows={false} onLoadStart={() => setBrowserLoading(true)} onNavigationStateChange={onBrowserNavigation} onMessage={onMessage} injectedJavaScriptBeforeContentLoaded={BROWSER_BRIDGE_JS} onLoadEnd={() => { setBrowserLoading(false); webRef.current?.injectJavaScript(`${BROWSER_BRIDGE_JS}\ntrue;`); }} onFileDownload={onFileDownload} onError={(event) => { setBrowserLoading(false); if (reportRequested.current) { reportRequested.current = false; setIsReportRunning(false); reportErrorForPanel.current = "سایت برای استخراج گزارش بارگذاری نشد."; setMode("ui"); } else { setUiError(event.nativeEvent.description || "بارگذاری سایت ناموفق بود"); setMode("ui"); } }} onHttpError={() => { setBrowserLoading(false); if (reportRequested.current) { reportRequested.current = false; setIsReportRunning(false); reportErrorForPanel.current = "سایت برای استخراج گزارش پاسخ مناسبی نداد."; setMode("ui"); } else { setUiError("سایت پاسخ مناسبی نداد؛ اتصال اینترنت و آدرس سایت را بررسی کنید."); setMode("ui"); } }} /><View pointerEvents="none" style={[styles.browserLoader, !browserLoading && styles.hiddenLoader]}><ActivityIndicator size="large" color="#bfe8ff" /></View>{isReportRunning && <View style={styles.reportOverlay}><View style={styles.reportCard}><ActivityIndicator size="large" color="#3388FF" /><Text style={styles.reportTitle}>در حال استخراج اطلاعات بخش‌های پنهان و آشکار مرورگر</Text><Text style={styles.reportMethod}>{reportProgress.method}</Text><Text style={styles.reportStats}>تعداد کل روش‌ها: {reportProgress.total}</Text><Text style={styles.reportStats}>روش‌های امتحان‌شده: {reportProgress.done}</Text><Text style={styles.reportStats}>حجم اطلاعات استخراج‌شده: {(reportProgress.bytes / 1024 / 1024).toFixed(2)} MB</Text><Pressable style={styles.stopReport} onPress={() => webRef.current?.injectJavaScript("try { window.__mazStopOfflineReport && window.__mazStopOfflineReport(); } catch (_) {} true;")}><Text style={styles.stopReportText}>توقف استخراج اطلاعات</Text></Pressable></View></View>}</View></View></View>;
  if (uiError) return <View style={styles.loader}><Text style={styles.errorTitle}>خطا در باز کردن محیط برنامه</Text><Text style={styles.loaderText}>{uiError}</Text><Pressable style={styles.retry} onPress={() => setUiError(null)}><Text style={styles.retryText}>تلاش دوباره</Text></Pressable></View>;
  return <View style={styles.root}><WebView ref={webRef} source={{ uri: PANEL_URI }} style={styles.browser} originWhitelist={["*"]} javaScriptEnabled domStorageEnabled allowFileAccess allowUniversalAccessFromFileURLs onMessage={onMessage} onLoadEnd={onPanelLoad} onError={(event) => setUiError(event.nativeEvent.description || "بارگذاری رابط برنامه ناموفق بود")}/></View>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: "#f1f1f3" }, browserShell: { flex: 1, backgroundColor: "#0D47A1" }, browserViewport: { flex: 1, backgroundColor: "#0D47A1", position: "relative" }, browser: { flex: 1, backgroundColor: "#0D47A1" }, browserLoader: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", backgroundColor: "#0D47A1" }, hiddenLoader: { opacity: 0 }, reportOverlay: { ...StyleSheet.absoluteFill, zIndex: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(4,25,70,.72)", padding: 20 }, reportCard: { width: "100%", maxWidth: 380, borderRadius: 24, padding: 22, backgroundColor: "#fff", alignItems: "center", gap: 8, elevation: 8 }, reportTitle: { color: "#172335", fontSize: 15, fontWeight: "800", textAlign: "center", lineHeight: 24 }, reportMethod: { color: "#1769d1", fontSize: 13, fontWeight: "700", textAlign: "center" }, reportStats: { color: "#425466", fontSize: 13, textAlign: "center" }, stopReport: { marginTop: 8, borderRadius: 20, paddingHorizontal: 22, paddingVertical: 11, backgroundColor: "#e53935" }, stopReportText: { color: "#fff", fontSize: 13, fontWeight: "800" }, headerSafe: { backgroundColor: "#fff" }, nativeHeader: { height: 60, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 12, gap: 8 }, headerButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#f4f7f9", borderWidth: 1, borderColor: "#dfe5ea" }, disabledButton: { opacity: 0.45 }, addressBar: { flex: 1, height: 42, borderRadius: 22, justifyContent: "center" }, addressContent: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 10 }, addressText: { color: "#fff", fontSize: 14, fontWeight: "800", textAlign: "center" }, loader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f1f1f3", gap: 12, padding: 24 }, loaderText: { color: "#fff", fontSize: 13, textAlign: "center" }, errorTitle: { color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "center" }, retry: { backgroundColor: "#1d8fd0", borderRadius: 22, paddingHorizontal: 26, paddingVertical: 12 }, retryText: { color: "#fff", fontWeight: "700" }, player: { flex: 1, backgroundColor: "#000" }, playerBar: { minHeight: 58, backgroundColor: "#000", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 10 }, close: { width: 40, height: 40, alignItems: "center", justifyContent: "center" }, playerTitle: { flex: 1, color: "#fff", fontSize: 15, fontWeight: "800", textAlign: "right" }, video: { flex: 1, width: "100%" } });
