if (process.env.NODE_ENV !== "production") {
  globalThis.__DEV__ = true;
}
/**
 * @param conditions assert conditions
 */
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

export const charRange = (begin: string, end: string) => {
  const start = begin.charCodeAt(0);
  return Array.from({ length: end.charCodeAt(0) - start + 1 }, (_, i) => String.fromCharCode(start + i));
};

export const toMap = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, true]));
