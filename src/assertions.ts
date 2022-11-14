import type react from "react";
import { LexicalScope, readCode, readCursor, readScopes } from "./lexer";
if (process.env.NODE_ENV !== "production") {
  globalThis.__DEV__ = true;
}
export const React: typeof import("react") = {
  // @ts-expect-error
  createElement: (fn: any, props: any): JSX.Element => {
    fn(props);
    return null as any;
  },
};

type Predicate<T> = (value: T) => boolean;

type TestOn<T> = T | Predicate<T>;

export interface AssertOptions {
  fn?: () => void;
  currentChar?: TestOn<string>;
  nextChar?: Predicate<string>;
  expectScopes?: LexicalScope[];
  excludeScopes?: LexicalScope[];
}

export const Assert: react.FC<react.PropsWithChildren<AssertOptions>> = ({
  fn,
  currentChar,
  nextChar,
  expectScopes,
  excludeScopes,
}) => {
  if (!__DEV__) {
    return null;
  }
  const tagged = (name: string) => console.error(`${fn?.name}: ${name}`);
  const code = readCode();
  const cursor = readCursor();
  const scopes = readScopes();
  const current = code[cursor];
  const next = code[cursor + 1];
  if (
    current &&
    ((typeof currentChar === "string" && currentChar !== current) ||
      (typeof currentChar === "function" && !currentChar(current)))
  ) {
    tagged(`current char: ${current}`);
  }
  if (next && typeof nextChar === "function" && !nextChar(next)) {
    tagged(`next: ${next}`);
  }
  const currentScope = scopes.at(-1);
  if (Array.isArray(expectScopes) && expectScopes.every((s) => s !== currentScope)) {
    tagged("expect scopes");
  }
  if (Array.isArray(excludeScopes) && excludeScopes.some((s) => s === currentScope)) {
    tagged("unexpected scopes");
  }
  return null;
};
