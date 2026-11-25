import * as FileSystem from "expo-file-system/legacy";
import { offlineRepository, cleanName } from "./repository";
import { MAX_TRANSFER_BYTES } from "../browser/site-bridge";
import type { OfflineVideo } from "./types";

type TransferSession = { id: string; name: string; mime: string; total: number; byteLength: number; chunks: Array<string | undefined> };

export class BlobTransferManager {
  private sessions = new Map<string, TransferSession>();

  start(input: { transferId: string; name?: string; mime?: string; total: number; byteLength: number }) {
    if (!input.transferId || !Number.isInteger(input.total) || input.total <= 0 || input.total > 50000 || input.byteLength <= 0 || input.byteLength > MAX_TRANSFER_BYTES) return false;
    this.sessions.set(input.transferId, { id: input.transferId, name: input.name || "biomaze-video.mp4", mime: input.mime || "video/mp4", total: input.total, byteLength: input.byteLength, chunks: new Array(input.total) });
    return true;
  }

  chunk(id: string, index: number, data: string) {
    const session = this.sessions.get(id);
    if (!session || !Number.isInteger(index) || index < 0 || index >= session.total || !data) return false;
    if (!session.chunks[index]) session.chunks[index] = data;
    return true;
  }

  async complete(id: string): Promise<OfflineVideo> {
    const session = this.sessions.get(id);
    this.sessions.delete(id);
    if (!session || session.chunks.length !== session.total || session.chunks.some((chunk) => !chunk)) throw new Error("TRANSFER_INCOMPLETE");
    const base64 = session.chunks.join("");
    if (base64.length > MAX_TRANSFER_BYTES * 2) throw new Error("TRANSFER_TOO_LARGE");
    const temp = await offlineRepository.tempUri(id);
    try {
      await FileSystem.writeAsStringAsync(temp, base64, { encoding: FileSystem.EncodingType.Base64 });
      const info = await FileSystem.getInfoAsync(temp);
      if (!info.exists || !("size" in info) || !info.size) throw new Error("EMPTY_FILE");
      return await offlineRepository.commitTemp(temp, cleanName(session.name), "webview-blob", undefined, session.mime);
    } catch (error) {
      await FileSystem.deleteAsync(temp, { idempotent: true }).catch(() => undefined);
      throw error;
    }
  }

  clear() { this.sessions.clear(); }
}
