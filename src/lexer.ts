import { assert, charRange, toMap } from "./util";

export const enum LexicalType {
  Identifier,
  Reserved,
  Operator,
  StringLiteral,
  NumericLiteral,
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
  Plus = "+",
  Minus = "-",
  QuestionMark = "?",
  ExclamationMark = "!",
  Comma = ",",
  Dot = ".",
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

const nextChar = (test: (char: string) => boolean) => ({
  nextChar: () => test(code[cursor]),
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
  for (let char = code[cursor]; ; char = code[++cursor]) {
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

const alphabet = charRange("a", "z");
const identifierNoDigitChars = [...alphabet, ...alphabet.map((c) => c.toUpperCase()), Chars.Dollar, Chars.UnderLine];
const identifierNoDigit = toMap(identifierNoDigitChars);

const digits = charRange("0", "9");
const identifier = toMap([...identifierNoDigitChars, ...digits]);

export const readWord = (): string => {
  assert({
    fn: readWord,
    ...currentChar((c) => identifierNoDigit[c]),
  });
  const begin = cursor;
  for (let char = code[cursor]!; identifier[char]; char = code[++cursor]);
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

//#region numeric literal
const decimals = toMap(digits);
const decimals_ = toMap(digits.concat(Chars.UnderLine));
export const readNumericLiteral = () => {
  assert({
    fn: readNumericLiteral,
    ...expectScopes([LexicalScope.NumericLiteral]),
    ...currentChar((c) => decimals[c] || c === Chars.Dot),
  });
  const first = code[cursor];
  if (first === "0") {
    assert({
      fn: readNumericLiteral,
      ...nextChar((c) => [..."bxo"].every((cc) => cc === c || cc === c.toLowerCase())),
    });
    switch (code[cursor + 1]) {
      case "b":
      case "B":
        return readBin();
      case "o":
      case "O":
        return readOct();
      case "x":
      case "X":
        return readHex();
    }
  }
  return readDecOrLegacyOct();
};

/**
 * Read an decimal literal. Legacy octal literal is also treated as decimal.
 */
export const readDecOrLegacyOct = () => {
  const start = cursor;
  let has89 = false;
  let char = code[cursor];
  const startsWithZero = char === "0";
  for (; decimals_[char]; char = code[++cursor]) {
    if (char === "8" || char === "9") {
      has89 = true;
    }
  }
  if (startsWithZero && !has89) {
    // legacy octal literal
    return code.slice(start, cursor);
  } else {
    if (char === Chars.Dot) {
      // float part
      for (char = code[++cursor]; decimals_[char]; char = code[++cursor]);
    }
    if (char === "e" || char === "E") {
      // exponential part
      char = code[++cursor];
      if (char === Chars.Minus || char === Chars.Plus) {
        char = code[++cursor];
      }
      for (; decimals_[char]; char = code[++cursor]);
    }
  }
  return code.slice(start, cursor);
};
const bins = charRange("0", "1");
const binary_ = toMap([...bins, Chars.UnderLine]);
export const readBin = () => {
  assert({
    fn: readBin,
    ...currentChar("0"),
  });
  const start = cursor;
  cursor += 2;
  for (let char = code[cursor]; binary_[char]; char = code[++cursor]);
  return code.slice(start, cursor);
};

const octs = charRange("0", "7");
const octal_ = toMap([...octs, Chars.UnderLine]);
export const readOct = () => {
  assert({
    fn: readBin,
    ...currentChar("0"),
  });
  const start = cursor;
  cursor += 2;
  for (let char = code[cursor]; octal_[char]; char = code[++cursor]);
  return code.slice(start, cursor);
};

const hexes = digits.concat(charRange("a", "f")).concat("A", "F");
const hexadecimal_ = toMap([...hexes, Chars.UnderLine]);
export const readHex = () => {
  assert({
    fn: readBin,
    ...currentChar("0"),
  });
  const start = cursor;
  cursor += 2;
  for (let char = code[cursor]; hexadecimal_[char]; char = code[++cursor]);
  return code.slice(start, cursor);
};

//#endregion
