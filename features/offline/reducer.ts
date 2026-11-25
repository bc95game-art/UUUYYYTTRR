export type LibraryPhase = "booting" | "ready" | "refreshing" | "error";
export type TransferPhase = "idle" | "downloading" | "verifying" | "committing" | "failed";

export type LibraryState = {
  phase: LibraryPhase;
  revision: number;
  error: string | null;
  transfer: { phase: TransferPhase; id: string | null; received: number; total: number; error: string | null };
};

export const initialLibraryState: LibraryState = { phase: "booting", revision: 0, error: null, transfer: { phase: "idle", id: null, received: 0, total: 0, error: null } };

type Action =
  | { type: "SNAPSHOT"; revision: number }
  | { type: "REFRESH_START" }
  | { type: "ERROR"; message: string }
  | { type: "TRANSFER_START"; id: string; total: number }
  | { type: "TRANSFER_PROGRESS"; id: string; received: number }
  | { type: "TRANSFER_VERIFY"; id: string }
  | { type: "TRANSFER_COMMIT"; id: string }
  | { type: "TRANSFER_FAIL"; id: string; message: string };

export function libraryReducer(state: LibraryState, action: Action): LibraryState {
  switch (action.type) {
    case "SNAPSHOT": return action.revision >= state.revision ? { ...state, phase: "ready", revision: action.revision, error: null } : state;
    case "REFRESH_START": return { ...state, phase: "refreshing", error: null };
    case "ERROR": return { ...state, phase: "error", error: action.message };
    case "TRANSFER_START": return { ...state, transfer: { phase: "downloading", id: action.id, received: 0, total: action.total, error: null } };
    case "TRANSFER_PROGRESS": return state.transfer.id === action.id ? { ...state, transfer: { ...state.transfer, received: action.received } } : state;
    case "TRANSFER_VERIFY": return state.transfer.id === action.id ? { ...state, transfer: { ...state.transfer, phase: "verifying" } } : state;
    case "TRANSFER_COMMIT": return state.transfer.id === action.id ? { ...state, transfer: { ...state.transfer, phase: "committing" } } : state;
    case "TRANSFER_FAIL": return state.transfer.id === action.id ? { ...state, transfer: { ...state.transfer, phase: "failed", error: action.message } } : state;
  }
}
