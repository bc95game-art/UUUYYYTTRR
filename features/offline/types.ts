export type OfflineVideoStatus = "ready" | "downloading" | "failed" | "corrupt";

export type OfflineVideoOrigin = "direct-download" | "webview-blob" | "legacy-scan";

export type OfflineVideo = {
  id: string;
  displayName: string;
  fileName: string;
  localUri: string;
  sizeBytes: number;
  mimeType: string;
  extension: string;
  createdAt: string;
  updatedAt: string;
  origin: OfflineVideoOrigin;
  sourceUrl?: string;
  status: OfflineVideoStatus;
  errorCode?: string;
};

export type LibrarySnapshot = {
  revision: number;
  files: OfflineVideo[];
};

export type PageReport = {
  id: string;
  capturedAt: string;
  url: string;
  title: string;
  readyState: string;
  referrer: string;
  media: Array<{ tag: string; src: string; currentSrc?: string; type?: string; size?: number }>;
  videoLinks: Array<{ url: string; text: string; download?: string }>;
  resources: Array<{ url: string; initiatorType?: string; size?: number; duration?: number }>;
  storage: { indexedDbNames: string[]; cacheNames: string[]; localStorageKeys: string[]; sessionStorageKeys: string[] };
  bridge: { installed: boolean; observedTransfers: number; observedDownloads: number };
};

export type BridgeEnvelope = {
  protocolVersion: 1;
  requestId: string;
  type: string;
  payload?: unknown;
};

export type BridgeMessage = BridgeEnvelope & {
  legacy?: Record<string, unknown>;
};

export type DownloadFailureCode =
  | "INVALID_URL"
  | "NO_STORAGE"
  | "HTTP_ERROR"
  | "EMPTY_FILE"
  | "UNSUPPORTED_SOURCE"
  | "NETWORK_ERROR"
  | "COMMIT_ERROR"
  | "NAME_EXISTS"
  | "TRANSFER_NOT_FOUND"
  | "TRANSFER_INCOMPLETE"
  | "TRANSFER_SIZE_MISMATCH"
  | "TRANSFER_CHUNK_REJECTED";
