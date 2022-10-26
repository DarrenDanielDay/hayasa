import { Assert, React } from "./assertions";
import { charRange, toMap } from "./util";

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
/**
 * @internal
 */
export const readCode = () => code;
export let cursor = 0;
/**
 * @internal
 */
export const readCursor = () => cursor;
/** Helps to see if non ignored newline is added. */
export let hasNewline = false;
export let scopes: LexicalScope[] = [];
/**
 * @internal
 */
export const readScopes = () => scopes;
export let enterScope: (scope: LexicalScope) => void = scopes.push.bind(scopes);
export let quiteScope: () => void = scopes.pop.bind(scopes);
export let tokens: LexicalToken[] = [];
/**
 * @internal
 */
export const readTokens = () => tokens;
export let resolveToken: (token: LexicalToken) => void = tokens.push.bind(tokens);

export const cleanUp = () => {
  cursor = 0;
  hasNewline = false;
  scopes = [LexicalScope.TopLevel];
  enterScope = scopes.push.bind(scopes);
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
  <Assert
    fn={skipCommentAndBlanks}
    excludeScopes={[
      LexicalScope.DoubleQuoteLiteral,
      LexicalScope.SingleQuoteLiteral,
      LexicalScope.NumericLiteral,
      LexicalScope.RegExpLiteral,
    ]}
  ></Assert>;
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
        <Assert fn={skipCommentAndBlanks} currentChar={Chars.Star}></Assert>;
        cursor += 2;
        continue;
      }
    }
    break;
  }
  <Assert fn={skipCommentAndBlanks} currentChar={(c) => c !== Chars.Space}></Assert>;
};

//#endregion

//#region identifier/keywords

const alphabet = charRange("a", "z");
const identifierNoDigitChars = [...alphabet, ...alphabet.map((c) => c.toUpperCase()), Chars.Dollar, Chars.UnderLine];
const identifierNoDigit = toMap(identifierNoDigitChars);

const digits = charRange("0", "9");
const identifier = toMap([...identifierNoDigitChars, ...digits]);

export const readWord = (): string => {
  <Assert fn={readWord} currentChar={(c) => identifierNoDigit[c]}></Assert>;
  const begin = cursor;
  for (let char = code[cursor]!; identifier[char]; char = code[++cursor]);
  <Assert fn={readWord} currentChar={(c) => !identifier[c]}></Assert>;
  const result = code.slice(begin, cursor);
  skipCommentAndBlanks();
  return result;
};

//#endregion

//#region string literal

const createQuoteScope = (quote: '"' | "'") => {
  const expectingScope = quote === "'" ? LexicalScope.SingleQuoteLiteral : LexicalScope.DoubleQuoteLiteral;
  return () => {
    <Assert currentChar={quote} expectScopes={[expectingScope]}></Assert>;
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
  <Assert
    fn={readNumericLiteral}
    excludeScopes={[LexicalScope.NumericLiteral]}
    currentChar={(c) => decimals[c] || c === Chars.Dot}
  ></Assert>;
  const first = code[cursor];
  if (first === "0") {
    <Assert
      fn={readNumericLiteral}
      nextChar={(c) => decimals[c] || [..."bxo"].some((cc) => cc === c || cc === c.toLowerCase())}
    ></Assert>;
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
  <Assert fn={readBin} currentChar="0"></Assert>;
  const start = cursor;
  cursor += 2;
  for (let char = code[cursor]; binary_[char]; char = code[++cursor]);
  return code.slice(start, cursor);
};

const octs = charRange("0", "7");
const octal_ = toMap([...octs, Chars.UnderLine]);
export const readOct = () => {
  <Assert fn={readOct} currentChar="0"></Assert>;

  const start = cursor;
  cursor += 2;
  for (let char = code[cursor]; octal_[char]; char = code[++cursor]);
  return code.slice(start, cursor);
};

const hexes = digits.concat(charRange("a", "f")).concat("A", "F");
const hexadecimal_ = toMap([...hexes, Chars.UnderLine]);
export const readHex = () => {
  <Assert fn={readHex} currentChar="0"></Assert>;
  const start = cursor;
  cursor += 2;
  for (let char = code[cursor]; hexadecimal_[char]; char = code[++cursor]);
  return code.slice(start, cursor);
};

//#endregion
