import type { BridgeMessage } from "../offline/types";

export const BRIDGE_PROTOCOL_VERSION = 1 as const;
let sequence = 0;
export const requestId = () => `req-${Date.now().toString(36)}-${(sequence++).toString(36)}`;

export function envelope(type: string, payload?: unknown): BridgeMessage {
  return { protocolVersion: BRIDGE_PROTOCOL_VERSION, requestId: requestId(), type, payload };
}

export function encode(type: string, payload?: unknown) {
  return JSON.stringify(envelope(type, payload));
}

export function decode(raw: string): BridgeMessage | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== "object" || typeof value.type !== "string") return null;
    if (value.protocolVersion === 1 && typeof value.requestId === "string") return value as unknown as BridgeMessage;
    // Backward-compatible normalization for the existing panel/site messages during migration.
    const { type, ...legacy } = value;
    return { protocolVersion: 1, requestId: requestId(), type, payload: legacy, legacy };
  } catch { return null; }
}

export function payloadOf<T extends Record<string, unknown>>(message: BridgeMessage): T {
  return (message.payload && typeof message.payload === "object" ? message.payload : message.legacy ?? {}) as T;
}
