import * as FileSystem from "expo-file-system/legacy";
import { offlineRepository, cleanName } from "./repository";
import type { OfflineVideo } from "./types";

export type DownloadResult = { file: OfflineVideo; id: string };
export type DownloadProgress = { id: string; phase: "downloading" | "verifying" | "committing"; bytes?: number; total?: number };
export type DownloadHeaders = { cookie?: string; referer?: string; userAgent?: string };

export async function downloadDirect(url: string, nameHint: string | undefined, onProgress?: (progress: DownloadProgress) => void, headers?: DownloadHeaders): Promise<DownloadResult> {
  if (!/^https?:/i.test(url)) throw new Error("INVALID_URL");
  if (/\.m3u8(?:[?#]|$)/i.test(url)) throw new Error("UNSUPPORTED_SOURCE");
  if (!FileSystem.documentDirectory) throw new Error("NO_STORAGE");
  const id = `download-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const temp = await offlineRepository.tempUri(id);
  try {
    await FileSystem.deleteAsync(temp, { idempotent: true });
    onProgress?.({ id, phase: "downloading" });
    const requestHeaders: Record<string, string> = {};
    if (headers?.cookie) requestHeaders.Cookie = headers.cookie;
    if (headers?.referer) requestHeaders.Referer = headers.referer;
    if (headers?.userAgent) requestHeaders["User-Agent"] = headers.userAgent;
    const result = await FileSystem.downloadAsync(url, temp, Object.keys(requestHeaders).length ? { headers: requestHeaders } : undefined);
    if (result.status < 200 || result.status >= 300) throw new Error("HTTP_ERROR");
    const info = await FileSystem.getInfoAsync(temp);
    if (!info.exists || !("size" in info) || !info.size) throw new Error("EMPTY_FILE");
    onProgress?.({ id, phase: "verifying", bytes: info.size, total: info.size });
    const fallback = url.split("?")[0].split("/").pop() || "biomaze-video.mp4";
    const file = await offlineRepository.commitTemp(temp, cleanName(nameHint || fallback), "direct-download", url);
    onProgress?.({ id, phase: "committing", bytes: file.sizeBytes, total: file.sizeBytes });
    return { id, file };
  } catch (error) {
    await FileSystem.deleteAsync(temp, { idempotent: true }).catch(() => undefined);
    throw error;
  }
}
