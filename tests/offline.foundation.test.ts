import { describe, expect, it } from "vitest";
import { initialLibraryState, libraryReducer } from "../features/offline/reducer";
import { SITE_BRIDGE_JS, TRANSFER_CHUNK_BYTES } from "../features/browser/site-bridge";

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

  it("uses acknowledged bounded chunks in the WebView bridge", () => {
    expect(TRANSFER_CHUNK_BYTES).toBeLessThanOrEqual(128 * 1024);
    expect(SITE_BRIDGE_JS).toContain("window.__mazAck");
    expect(SITE_BRIDGE_JS).toContain("window.__mazNack");
    expect(SITE_BRIDGE_JS).toContain("blob.slice");
    expect(SITE_BRIDGE_JS).not.toContain("for(var i=0;i<total;i++)");
  });

  it("installs the site bridge once and avoids an endless cache scan loop", () => {
    expect(SITE_BRIDGE_JS).toContain("__mazBridgeInstalled");
    expect(SITE_BRIDGE_JS).toContain("scanOnce");
    expect(SITE_BRIDGE_JS).not.toContain("setInterval(scan");
  });

});
