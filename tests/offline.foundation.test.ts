import { describe, expect, it } from "vitest";
import { initialLibraryState, libraryReducer } from "../features/offline/reducer";

describe("offline foundation", () => {
  it("accepts only newer library revisions", () => {
    const ready = libraryReducer(initialLibraryState, { type: "SNAPSHOT", revision: 4 });
    expect(ready.phase).toBe("ready");
    expect(ready.revision).toBe(4);
    expect(libraryReducer(ready, { type: "SNAPSHOT", revision: 3 })).toEqual(ready);
  });

  it("models transfer verification and commit", () => {
    const started = libraryReducer(initialLibraryState, { type: "TRANSFER_START", id: "x", total: 10 });
    const verifying = libraryReducer(started, { type: "TRANSFER_VERIFY", id: "x" });
    const committed = libraryReducer(verifying, { type: "TRANSFER_COMMIT", id: "x" });
    expect(committed.transfer.phase).toBe("committing");
  });

  it("rejects stale transfer progress and records failures for the active transfer", () => {
    const started = libraryReducer(initialLibraryState, { type: "TRANSFER_START", id: "active", total: 100 });
    expect(libraryReducer(started, { type: "TRANSFER_PROGRESS", id: "other", received: 99 })).toEqual(started);
    const failed = libraryReducer(started, { type: "TRANSFER_FAIL", id: "active", message: "TRANSFER_INCOMPLETE" });
    expect(failed.transfer.phase).toBe("failed");
    expect(failed.transfer.error).toBe("TRANSFER_INCOMPLETE");
  });

});
