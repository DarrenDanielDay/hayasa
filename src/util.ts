export const charRange = (begin: string, end: string) => {
  const start = begin.charCodeAt(0);
  return Array.from({ length: end.charCodeAt(0) - start + 1 }, (_, i) => String.fromCharCode(start + i));
};

export const toMap = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, true]));
