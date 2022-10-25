import { assert } from "./util";

export const enum LexicalType {
  Identifier,
  Reserved,
  Operator,
  StringLiteral,
  NumberLiteral,
}
export const enum LexicalScope {
  TopLevel,
  WithExport,
  WithImport,
  WithTopLevelAwait,

  WithVar,
  WithLet,
  WithConst,
  WithFunction,
  WithAsync,

  Block,
  AsyncBlock,
  GeneratorBlock,
  NumericLiteral,
  SingleQuoteLiteral,
  DoubleQuoteLiteral,
  TemplateLiteral,
  RegExpLiteral,
  TypeAnnotation,
}

export const enum Chars {
  Space = " ",
  NewLine = "\n",
  Slash = "/",
  BackSlash = "\\",
  SingleQuote = "'",
  DoubleQuote = '"',
  Star = "*",
  Dollar = "$",
  UnderLine = "_",
  Assign = "=",
  QuestionMark = "?",
  ExclamationMark = "!",
  Comma = ",",
  Colon = ":",
  Semicolon = ";",
  LParenthesis = "(",
  RParenthesis = ")",
  LBracket = "[",
  RBracket = "]",
  LBrace = "{",
  RBrace = "}",
  LT = "<",
  GT = ">",
}

export const enum ReservedOrKeywords {
  // declarations
  Const = "const",
  Var = "var",
  Let = "let",

  // loops/scope
  With = "with",
  Function = "Function",
  For = "for",
  While = "while",
  Do = "do",

  // import/export
  Import = "import",
  Export = "export",
  Package = "package",

  // generator
  Yield = "yield",
  Enum = "enum",

  // async/await
  Async = "async",
  Await = "await",
}

export interface LexicalToken {
  type: LexicalType;
  content: string;
}

//#region global states
export let code: string = "";
export let cursor = 0;
/** Helps to see if non ignored newline is added. */
export let hasNewline = false;
export let scopes: LexicalScope[] = [];
export let enterScope: (scope: LexicalScope) => void = scopes.push.bind(scopes);
export let quiteScope: () => void = scopes.pop.bind(scopes);
export let tokens: LexicalToken[] = [];
export let resolveToken: (token: LexicalToken) => void = tokens.push.bind(tokens);

const currentChar = (test: string | ((char: string) => boolean)) => ({
  currentChar: () => (typeof test === "string" ? test === code[cursor] : test(code[cursor])),
});

const expectScopes = (scopes: LexicalScope[]) => ({
  expectScopes: () => {
    const scope = scopes.at(-1)!;
    return scopes.some((s) => s === scope);
  },
});
expectScopes.not = (unexpectedScopes: LexicalScope[]) => ({
  expectScopesNot: () => {
    const scope = scopes.at(-1)!;
    return unexpectedScopes.every((s) => s !== scope);
  },
});

export const cleanUp = () => {
  cursor = 0;
  hasNewline = false;
  scopes = [LexicalScope.TopLevel];
  quiteScope = scopes.pop.bind(scopes);
  tokens = [];
  resolveToken = tokens.push.bind(tokens);
};

export const initCode = (input: string) => {
  code = input;
};

//#endregion

//#region comments/blanks

/**
 * Skip comments and blanks. They will never be preserved in `hayasa`.
 */
export const skipCommentAndBlanks = () => {
  assert({
    fn: skipCommentAndBlanks,
    ...expectScopes.not([
      LexicalScope.DoubleQuoteLiteral,
      LexicalScope.SingleQuoteLiteral,
      LexicalScope.NumericLiteral,
      LexicalScope.RegExpLiteral,
    ]),
  });
  for (; ; cursor++) {
    const char = code[cursor];
    if (char === Chars.Space) {
      continue;
    }
    if (char === Chars.NewLine) {
      hasNewline = true;
      continue;
    }
    if (char === Chars.Slash) {
      const next = code[cursor + 1];
      if (next === Chars.Slash) {
        cursor++;
        for (; code[cursor] !== Chars.NewLine; cursor++);
        hasNewline = true;
        continue;
      }
      if (next === Chars.Star) {
        cursor++;
        while (code[cursor] !== Chars.Star || code[cursor + 1] !== Chars.Slash) cursor++;
        assert({
          fn: skipCommentAndBlanks,
          ...currentChar(Chars.Star),
        });
        cursor += 2;
        continue;
      }
    }
    break;
  }
  assert({
    fn: skipCommentAndBlanks,
    ...currentChar((c) => c !== Chars.Space),
  });
};

//#endregion

//#region identifier/keywords

const alphabet = Array.from({ length: 26 }, (_, i) => String.fromCharCode("a".charCodeAt(0) + i));
const identifierNoDigitChars = [...alphabet, ...alphabet.map((c) => c.toUpperCase()), "$", "_"];
const identifierNoDigit = Object.fromEntries(identifierNoDigitChars.map((c) => [c, true]));

const digits = Array.from({ length: 10 }, (_, i) => i.toString());
const identifier = Object.fromEntries([...identifierNoDigitChars, ...digits].map((c) => [c, true]));

export const readWord = (): string => {
  assert({
    fn: readWord,
    ...currentChar((c) => identifierNoDigit[c]),
  });
  const begin = cursor;
  for (let char = code[cursor]!; identifier[char]; cursor++, char = code[cursor]);
  assert({
    fn: readWord,
    ...currentChar((c) => !identifier[c]),
  });
  const result = code.slice(begin, cursor);
  skipCommentAndBlanks();
  return result;
};

//#endregion

//#region string literal

const createQuoteScope = (quote: '"' | "'") => {
  const expectingScope = quote === "'" ? LexicalScope.SingleQuoteLiteral : LexicalScope.DoubleQuoteLiteral;
  return () => {
    assert({
      ...currentChar(quote),
      ...expectScopes([expectingScope]),
    });
    const start = cursor;
    cursor++;
    while (code[cursor] !== quote) {
      while (code[cursor] !== quote) cursor++; // Cursor will stop at quote.
      const previous = code[cursor - 1];
      if (previous === Chars.BackSlash) {
        // If it's an escape character, move to next and continue loop.
        cursor++;
      }
    }
    cursor++;
    const rawLiteral = code.slice(start, cursor);
    resolveToken({
      content: rawLiteral,
      type: LexicalType.StringLiteral,
    });
    quiteScope();
  };
};
export const singleQuoteScope = createQuoteScope("'");
export const doubleQuoteScope = createQuoteScope('"');
//#endregion
