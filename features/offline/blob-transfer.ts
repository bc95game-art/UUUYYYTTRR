import * as FileSystem from "expo-file-system/legacy";
import { offlineRepository, cleanName } from "./repository";
import { MAX_TRANSFER_BYTES } from "../browser/site-bridge";
import type { OfflineVideo } from "./types";

type TransferSession = { id: string; name: string; mime: string; total: number; byteLength: number; chunks: Array<string | undefined>; received: number };

export class BlobTransferManager {
  private sessions = new Map<string, TransferSession>();

  start(input: { transferId: string; name?: string; mime?: string; total: number; byteLength: number }) {
    if (!input.transferId || this.sessions.has(input.transferId) || !Number.isInteger(input.total) || input.total <= 0 || input.total > 50000 || !Number.isInteger(input.byteLength) || input.byteLength <= 0 || input.byteLength > MAX_TRANSFER_BYTES) return false;
    this.sessions.set(input.transferId, { id: input.transferId, name: input.name || "biomaze-video.mp4", mime: input.mime || "video/mp4", total: input.total, byteLength: input.byteLength, chunks: new Array(input.total), received: 0 });
    return true;
  }

  chunk(id: string, index: number, data: string) {
    const session = this.sessions.get(id);
    if (!session || !Number.isInteger(index) || index < 0 || index >= session.total || !data) return false;
    const previous = session.chunks[index];
    if (previous) return previous === data;
    session.chunks[index] = data;
    session.received += 1;
    return true;
  }

  progress(id: string) { const session = this.sessions.get(id); return session ? { received: session.received, total: session.total } : null; }

  async complete(id: string): Promise<OfflineVideo> {
    const session = this.sessions.get(id);
    if (!session) throw new Error("TRANSFER_NOT_FOUND");
    if (session.received !== session.total || session.chunks.some((chunk) => !chunk)) throw new Error("TRANSFER_INCOMPLETE");
    const base64 = session.chunks.join("");
    if (base64.length > MAX_TRANSFER_BYTES * 2) throw new Error("TRANSFER_TOO_LARGE");
    const temp = await offlineRepository.tempUri(id);
    try {
      await FileSystem.deleteAsync(temp, { idempotent: true });
      await FileSystem.writeAsStringAsync(temp, base64, { encoding: FileSystem.EncodingType.Base64 });
      const info = await FileSystem.getInfoAsync(temp);
      if (!info.exists || !("size" in info) || !info.size) throw new Error("EMPTY_FILE");
      if (info.size !== session.byteLength) throw new Error("TRANSFER_SIZE_MISMATCH");
      const file = await offlineRepository.commitTemp(temp, cleanName(session.name), "webview-blob", undefined, session.mime);
      this.sessions.delete(id);
      return file;
    } catch (error) {
      await FileSystem.deleteAsync(temp, { idempotent: true }).catch(() => undefined);
      this.sessions.delete(id);
      throw error;
    }
  }

  abort(id: string) { this.sessions.delete(id); }
  clear() { this.sessions.clear(); }
}
