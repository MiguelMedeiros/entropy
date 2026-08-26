export type SensitiveRevealState = {
  showPassphrase: boolean;
  showSeed: boolean;
  privateKeyIds: ReadonlySet<string>;
};

export type SensitiveRevealAction =
  | { type: "toggle-passphrase" }
  | { type: "toggle-seed" }
  | { type: "toggle-private-key"; keyId: string }
  | { type: "clear-private-keys" }
  | { type: "conceal-all" };

export function createSensitiveRevealState(): SensitiveRevealState {
  return { showPassphrase: false, showSeed: false, privateKeyIds: new Set() };
}

export function sensitiveRevealReducer(
  state: SensitiveRevealState,
  action: SensitiveRevealAction,
): SensitiveRevealState {
  switch (action.type) {
    case "toggle-passphrase":
      return { ...state, showPassphrase: !state.showPassphrase };
    case "toggle-seed":
      return { ...state, showSeed: !state.showSeed };
    case "toggle-private-key": {
      const privateKeyIds = new Set(state.privateKeyIds);
      if (privateKeyIds.has(action.keyId)) privateKeyIds.delete(action.keyId);
      else privateKeyIds.add(action.keyId);
      return { ...state, privateKeyIds };
    }
    case "clear-private-keys":
      return { ...state, privateKeyIds: new Set() };
    case "conceal-all":
      return createSensitiveRevealState();
  }
}
