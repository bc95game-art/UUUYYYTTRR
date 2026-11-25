import * as FileSystem from "expo-file-system/legacy";
import type { OfflineVideo, OfflineVideoOrigin, LibrarySnapshot } from "./types";

export const OFFLINE_DIR = `${FileSystem.documentDirectory ?? ""}offline/`;
const MANIFEST_URI = `${OFFLINE_DIR}.manifest.json`;
const PART_SUFFIX = ".part";
const VIDEO_EXTENSIONS = /\.(mp4|m4v|webm|mov|mkv|3gp|ts|m4s|aac|m3u8)$/i;

type Manifest = { schemaVersion: 1; revision: number; files: OfflineVideo[] };

const now = () => new Date().toISOString();
const cleanName = (value: string, fallback = "biomaze-video.mp4") => {
  const decoded = (() => { try { return decodeURIComponent(value); } catch { return value; } })();
  const safe = decoded.replace(/[^\p{L}\p{N}._()\- ]/gu, "_").trim();
  return safe || fallback;
};
const extensionOf = (name: string) => name.match(/\.[A-Za-z0-9]{2,8}$/)?.[0].toLowerCase() ?? ".mp4";
const mimeOf = (name: string) => {
  const ext = extensionOf(name);
  return ({ ".mp4": "video/mp4", ".m4v": "video/x-m4v", ".webm": "video/webm", ".mov": "video/quicktime", ".mkv": "video/x-matroska", ".3gp": "video/3gpp", ".ts": "video/mp2t", ".m4s": "video/iso.segment", ".m3u8": "application/vnd.apple.mpegurl" } as Record<string, string>)[ext] ?? "video/mp4";
};
const stableId = (name: string, size: number) => {
  let hash = 2166136261;
  for (const char of `${name}:${size}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `vid-${(hash >>> 0).toString(16)}-${Math.max(0, size).toString(16)}`;
};

async function ensureDir() {
  if (!FileSystem.documentDirectory) throw new Error("NO_STORAGE");
  await FileSystem.makeDirectoryAsync(OFFLINE_DIR, { intermediates: true }).catch(() => undefined);
}
async function readManifest(): Promise<Manifest | null> {
  try {
    const raw = await FileSystem.readAsStringAsync(MANIFEST_URI);
    const parsed = JSON.parse(raw) as Manifest;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.files)) return null;
    return { schemaVersion: 1, revision: Number(parsed.revision) || 0, files: parsed.files };
  } catch { return null; }
}
async function writeManifest(manifest: Manifest) {
  const temp = `${MANIFEST_URI}.part`;
  await FileSystem.writeAsStringAsync(temp, JSON.stringify(manifest));
  await FileSystem.deleteAsync(MANIFEST_URI, { idempotent: true }).catch(() => undefined);
  await FileSystem.moveAsync({ from: temp, to: MANIFEST_URI });
}
async function info(uri: string) {
  return FileSystem.getInfoAsync(uri).catch(() => ({ exists: false as const }));
}
async function scanPhysical(existing: OfflineVideo[]) {
  await ensureDir();
  const names = await FileSystem.readDirectoryAsync(OFFLINE_DIR).catch(() => [] as string[]);
  const known = new Map(existing.map((file) => [file.fileName, file]));
  const result = existing.filter((file) => file.fileName && names.includes(file.fileName));
  for (const fileName of names) {
    if (fileName.startsWith(".") || fileName.endsWith(PART_SUFFIX) || fileName === ".manifest.json" || known.has(fileName)) continue;
    const fileInfo = await info(`${OFFLINE_DIR}${fileName}`);
    if (!fileInfo.exists || ("isDirectory" in fileInfo && fileInfo.isDirectory)) continue;
    const sizeBytes = "size" in fileInfo && typeof fileInfo.size === "number" ? fileInfo.size : 0;
    if (!sizeBytes || (!VIDEO_EXTENSIONS.test(fileName) && sizeBytes < 1024)) continue;
    const timestamp = now();
    result.push({ id: stableId(fileName, sizeBytes), displayName: fileName, fileName, localUri: `${OFFLINE_DIR}${fileName}`, sizeBytes, mimeType: mimeOf(fileName), extension: extensionOf(fileName), createdAt: timestamp, updatedAt: timestamp, origin: "legacy-scan", status: "ready" });
  }
  return result;
}

export class OfflineRepository {
  private manifest: Manifest = { schemaVersion: 1, revision: 0, files: [] };
  private initialized = false;

  async initialize(): Promise<LibrarySnapshot> {
    if (!this.initialized) {
      await ensureDir();
      this.manifest = (await readManifest()) ?? this.manifest;
      this.manifest.files = await scanPhysical(this.manifest.files);
      this.manifest.revision += 1;
      await writeManifest(this.manifest);
      this.initialized = true;
    } else {
      await this.refresh();
    }
    return this.snapshot();
  }
  snapshot(): LibrarySnapshot { return { revision: this.manifest.revision, files: this.manifest.files.filter((file) => file.status === "ready") }; }
  async refresh() { await ensureDir(); this.manifest.files = await scanPhysical(this.manifest.files); this.manifest.revision += 1; await writeManifest(this.manifest); return this.snapshot(); }
  async register(uri: string, requestedName: string, origin: OfflineVideoOrigin, sourceUrl?: string, mimeType?: string) {
    await this.initialize();
    const fileInfo = await info(uri);
    if (!fileInfo.exists || !("size" in fileInfo) || !fileInfo.size) throw new Error("EMPTY_FILE");
    const fileName = uri.split("/").pop() || cleanName(requestedName);
    const timestamp = now();
    const existing = this.manifest.files.find((file) => file.fileName === fileName);
    const record: OfflineVideo = { id: existing?.id ?? stableId(fileName, fileInfo.size), displayName: existing?.displayName ?? cleanName(requestedName || fileName), fileName, localUri: uri, sizeBytes: fileInfo.size, mimeType: mimeType || existing?.mimeType || mimeOf(fileName), extension: extensionOf(fileName), createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp, origin, sourceUrl, status: "ready" };
    this.manifest.files = [...this.manifest.files.filter((file) => file.id !== record.id && file.fileName !== fileName), record];
    this.manifest.revision += 1; await writeManifest(this.manifest); return record;
  }
  async rename(id: string, requestedName: string) {
    await this.initialize();
    const current = this.manifest.files.find((file) => file.id === id); if (!current) throw new Error("NOT_FOUND");
    const typed = cleanName(requestedName, current.displayName); const ext = extensionOf(current.fileName);
    const newFileName = /\.[A-Za-z0-9]{2,8}$/.test(typed) ? typed : `${typed}${ext}`;
    const target = `${OFFLINE_DIR}${newFileName}`;
    if (target !== current.localUri) await FileSystem.moveAsync({ from: current.localUri, to: target });
    const updated = { ...current, displayName: newFileName, fileName: newFileName, localUri: target, extension: extensionOf(newFileName), updatedAt: now() };
    this.manifest.files = this.manifest.files.map((file) => file.id === id ? updated : file); this.manifest.revision += 1; await writeManifest(this.manifest); return updated;
  }
  async remove(id: string) {
    await this.initialize();
    const current = this.manifest.files.find((file) => file.id === id); if (!current) return this.snapshot();
    await FileSystem.deleteAsync(current.localUri, { idempotent: true });
    this.manifest.files = this.manifest.files.filter((file) => file.id !== id); this.manifest.revision += 1; await writeManifest(this.manifest); return this.snapshot();
  }
  async commitTemp(tempUri: string, requestedName: string, origin: OfflineVideoOrigin, sourceUrl?: string, mimeType?: string) {
    await ensureDir();
    const safe = cleanName(requestedName); const ext = extensionOf(safe); const stem = safe.slice(0, -ext.length) || "biomaze-video";
    const existingNames = new Set((await FileSystem.readDirectoryAsync(OFFLINE_DIR).catch(() => [] as string[])).filter((name) => !name.endsWith(PART_SUFFIX)));
    let fileName = `${stem}${ext}`; let index = 1;
    while (existingNames.has(fileName)) fileName = `${stem} (${index++})${ext}`;
    const finalUri = `${OFFLINE_DIR}${fileName}`;
    await FileSystem.moveAsync({ from: tempUri, to: finalUri });
    return this.register(finalUri, fileName, origin, sourceUrl, mimeType);
  }
  async tempUri(id: string) { await ensureDir(); return `${OFFLINE_DIR}.${id}${PART_SUFFIX}`; }
}

export const offlineRepository = new OfflineRepository();
export { cleanName, extensionOf, mimeOf };
