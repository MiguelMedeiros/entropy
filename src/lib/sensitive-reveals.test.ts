import { describe, expect, it } from "vitest";
import { createSensitiveRevealState, sensitiveRevealReducer } from "./sensitive-reveals";

describe("sensitive reveal state", () => {
  it("conceals the seed and every private key together", () => {
    let state = createSensitiveRevealState();
    state = sensitiveRevealReducer(state, { type: "toggle-seed" });
    state = sensitiveRevealReducer(state, { type: "toggle-private-key", keyId: "wallet-key" });

    expect(state.showSeed).toBe(true);
    expect(state.privateKeyIds.has("wallet-key")).toBe(true);

    state = sensitiveRevealReducer(state, { type: "conceal-all" });

    expect(state.showSeed).toBe(false);
    expect(state.privateKeyIds.size).toBe(0);
  });
});
