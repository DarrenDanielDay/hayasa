export const charRange = (begin: string, end: string) => {
  const start = begin.charCodeAt(0);
  return Array.from({ length: end.charCodeAt(0) - start + 1 }, (_, i) => String.fromCharCode(start + i));
};

export const toMap = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, true]));

export interface TrieNode {
  [key: string]: TrieNode | undefined;
}

export const trie = () => {
  const root: TrieNode = {};
  const insert = (text: string) => {
    let node = root;
    for (const char of text) {
      node = node[char] ||= {};
    }
  };
  return [root, insert] as const;
};

export const longestMatchLength = (root: TrieNode, code: string, begin: number): number => {
  let count = 0;
  const codeLength = code.length;
  let node = root;
  for (let i = begin; i < codeLength; i++) {
    const char = code[i];
    const next = node[char];
    if (!next) {
      break;
    }
    node = next;
    count++
  }
  return count;
};
