if (process.env.NODE_ENV !== "production") {
  globalThis.__DEV__ = true;
}
export const assert = (conditions: Record<string, boolean | (() => any)> & { fn?: () => any }) => {
  if (__DEV__) {
    const { fn, ...others } = conditions;
    const emitError = (msg: string) => {
      console.error(`${fn?.name}: ${msg}`);
    };
    for (const [k, v] of Object.entries(others)) {
      if (!v) {
        emitError(k);
      }
      if (typeof v === "function") {
        const res = v();
        if (!res) {
          emitError(k);
        }
      }
    }
  }
};
