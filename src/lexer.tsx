import { Assert, React } from "./assertions";
import { charRange, longestMatchLength, syntaxError, toMap, trie } from "./util";

//#region enums

export const enum LexicalType {
  Identifier,
  Reserved,
  Punctuator,
  StringLiteral,
  NumericLiteral,
  Template,
  RegularExpressionLiteral,
}
export const enum LexicalScope {
  TopLevel,
  /**
   * `( ... )`
   */
  Parenthesis,
  /**
   * `[ ... ]`
   */
  Bracket,
  /**
   * `{ ... }`
   */
  Brace,
  /**
   * ``
   */
  TemplateLiteral,
  /**
   * ` ... ${ ... } ... `
   */
  TemplateLiteralExpression,
}

export const enum Chars {
  GraveAccent = "`",
  Inverse = "~",
  ExclamationMark = "!",
  At = "@",
  Pound = "#",
  Dollar = "$",
  Percentage = "%",
  Circumflex = "^",
  And = "&",
  Star = "*",
  LParenthesis = "(",
  RParenthesis = ")",
  Minus = "-",
  UnderLine = "_",
  Assign = "=",
  Plus = "+",
  LBracket = "[",
  LBrace = "{",
  RBracket = "]",
  RBrace = "}",
  BackSlash = "\\",
  Or = "|",
  Semicolon = ";",
  Colon = ":",
  SingleQuote = "'",
  DoubleQuote = '"',
  NewLine = "\n",
  Comma = ",",
  LT = "<",
  Dot = ".",
  GT = ">",
  QuestionMark = "?",
  Slash = "/",
  Space = " ",
}

const reservedWord = toMap(
  "await break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield".split(
    " "
  )
);

export interface LexicalToken {
  type: LexicalType;
  content: string;
}

//#endregion

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
/**
 * @internal
 */
export const setCursor = (value: number) => (cursor = value);
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
  <Assert fn={skipCommentAndBlanks} excludeScopes={[]}></Assert>;
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
  return result;
};

//#endregion

//#region string literal

const skipEscapeSequence = () => {
  <Assert fn={skipEscapeSequence} currentChar={Chars.BackSlash}></Assert>;
  const escapeChar = code[++cursor];
  switch (escapeChar) {
    case "u": // Unicode escape
      cursor += 4;
      break;
    case "x": // Latin-1 escape
      cursor += 2;
      break;
    default: // \0 \' \" \\ \n \r \v \t \b \f and legacy octal escape
      // Since hayasa will never interpret them, other cases we can just skip the character.
      cursor++;
      break;
  }
};

const createQuoteScope = (quote: '"' | "'") => {
  return () => {
    <Assert currentChar={quote}></Assert>;
    const start = cursor;
    for (let char = code[++cursor]; char !== quote; ) {
      if (char === Chars.BackSlash) {
        skipEscapeSequence();
        char = code[cursor];
        continue;
      }
      char = code[++cursor]
    }
    // Skip ending quote.
    cursor++;
    const rawLiteral = code.slice(start, cursor);
    resolveToken({
      content: rawLiteral,
      type: LexicalType.StringLiteral,
    });
  };
};
export const singleQuoteScope = createQuoteScope("'");
export const doubleQuoteScope = createQuoteScope('"');
//#endregion

//#region numeric literal
const decimals = toMap(digits);
const decimals_ = toMap(digits.concat(Chars.UnderLine));
const numericLiteralStart = toMap([...digits, Chars.Dot]);
export const readNumericLiteral = () => {
  <Assert fn={readNumericLiteral} currentChar={(c) => decimals[c] || c === Chars.Dot}></Assert>;
  const first = code[cursor];
  if (first === "0") {
    <Assert
      fn={readNumericLiteral}
      nextChar={(c) =>
        !c.trim() || !!operatorTrie[c] || decimals[c] || [..."bxo"].some((cc) => cc === c || cc === c.toLowerCase())
      }
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

//#region template literal
export const readTemplateLiteral = () => {
  <Assert fn={readTemplateLiteral} expectScopes={[LexicalScope.TemplateLiteral]}></Assert>;
  const start = cursor;
  let char = code[cursor];
  while (char !== Chars.GraveAccent) {
    if (char === Chars.BackSlash) {
      skipEscapeSequence();
      char = code[cursor];
      continue;
    }
    if (char === Chars.Dollar && code[cursor + 1] === Chars.LBrace) {
      // Move to brace as ending punctuator.
      cursor++;
      enterScope(LexicalScope.TemplateLiteralExpression);
      break;
    }
    char = code[++cursor];
  }
  if (char === Chars.GraveAccent) {
    quiteScope();
  }
  // Skip ending punctuator.
  cursor++;
  return code.slice(start, cursor);
};

//#endregion

//#region regular expression literal
export const readRegExpLiteral = () => {
  <Assert fn={readRegExpLiteral} currentChar={Chars.Slash}></Assert>;
  const start = cursor;
  for (let char = code[++cursor]; char !== Chars.Slash; ) {
    if (char === Chars.BackSlash) {
      skipEscapeSequence();
      char = code[cursor];
      continue;
    }
    char = code[++cursor];
  }
  // Skip ending `/`.
  cursor++;
  const regLiteral = code.slice(start, cursor);
  if (identifier[code[cursor]]) {
    const flags = readWord();
    return regLiteral + flags;
  }
  return regLiteral;
};

//#endregion
const [operatorTrie, insertOperator] = trie();
const punctuators =
  "{ } ( ) [ ] . ... ; , < > <= >= == != === !== + - * / % ** ++ -- << >> >>> & | ^ ! ~ && || ?? ? : = += -= *= %= **= <<= >>= >>>= &= |= ^= &&= ||= ??= =>".split(
    " "
  );
// const punctuators = toMap(["?", ...otherPunctuators.map((p) => p[0]!)]);
for (const otherPunctuator of punctuators) {
  insertOperator(otherPunctuator);
}

export const readPunctuator = () => {
  const current = code[cursor];
  const start = cursor;
  if (current === Chars.QuestionMark) {
    if (code[cursor + 1] === Chars.Dot && !decimals[code[cursor + 2]!]) {
      // Treat as optional chaining.
      // `?.`
      cursor += 2;
    } else {
      // Treat as conditional.
      // `?`
      cursor++;
    }
  } else {
    const length = longestMatchLength(operatorTrie, code, cursor);
    cursor += length;
  }
  const punctuator = code.slice(start, cursor);
  return punctuator;
};

const closingTokens = toMap([Chars.RParenthesis, Chars.RBracket, Chars.RBrace]);
const matchingScope: Record<string, LexicalScope> = {
  [Chars.RParenthesis]: LexicalScope.Parenthesis,
  [Chars.RBracket]: LexicalScope.Bracket,
  [Chars.RBrace]: LexicalScope.Brace,
};
const semi = { type: LexicalType.Punctuator, content: Chars.Semicolon };

export const tokenize = (input: string): LexicalToken[] => {
  cleanUp();
  initCode(input);
  const codeLength = code.length;
  while (cursor < codeLength) {
    skipCommentAndBlanks();
    const head = code[cursor];
    //#region string literal
    if (head === Chars.SingleQuote) {
      singleQuoteScope();
      continue;
    }
    if (head === Chars.DoubleQuote) {
      doubleQuoteScope();
      continue;
    }
    //#endregion

    //#region numeric literal
    if (numericLiteralStart[head]) {
      if (!(head === Chars.Dot && !decimals[code[cursor + 1]])) {
        const numericLiteral = readNumericLiteral();
        resolveToken({
          content: numericLiteral,
          type: LexicalType.NumericLiteral,
        });
        continue;
      }
    }
    //#endregion

    //#region punctuator & regular expression & template literal expression terminator
    if (operatorTrie[head]) {
      if (head === Chars.Slash) {
        const { content, type } = tokens.at(-1) ?? semi;
        if (
          type === LexicalType.Reserved ||
          (type === LexicalType.Punctuator && content !== Chars.RBracket && content !== Chars.RParenthesis)
        ) {
          const regexp = readRegExpLiteral();
          resolveToken({
            content: regexp,
            type: LexicalType.RegularExpressionLiteral,
          });
          continue;
        }
      }
      const currentScope = scopes.at(-1);
      if (head === Chars.RBrace) {
        if (currentScope === LexicalScope.TemplateLiteralExpression) {
          quiteScope();
          const template = readTemplateLiteral();
          resolveToken({
            content: template,
            type: LexicalType.Template,
          });
          continue;
        }
      }
      const punctuator = readPunctuator();
      resolveToken({
        content: punctuator,
        type: LexicalType.Punctuator,
      });
      if (closingTokens[head]) {
        if (__DEV__) {
          const matched = matchingScope[head];
          if (currentScope !== matched) {
            return syntaxError(`Unmatched closing token: "${head}"`, code, cursor - 1);
          }
        }
        quiteScope();
      } else if (head === Chars.LParenthesis) {
        enterScope(LexicalScope.Parenthesis);
      } else if (head === Chars.LBracket) {
        enterScope(LexicalScope.Bracket);
      } else if (head === Chars.LBrace) {
        enterScope(LexicalScope.Brace);
      }
      continue;
    }
    //#endregion

    //#region template literal
    if (head === Chars.GraveAccent) {
      enterScope(LexicalScope.TemplateLiteral);
      cursor++;
      const templateLiteral = readTemplateLiteral();
      resolveToken({
        content: `\`${templateLiteral}`,
        type: LexicalType.Template,
      });
      continue;
    }
    //#endregion

    //#region identifier & keyword
    const word = readWord();
    const lastToken = tokens.at(-1) ?? semi;
    resolveToken({
      content: word,
      type: reservedWord[word] && lastToken.content !== Chars.Dot ? LexicalType.Reserved : LexicalType.Identifier,
    });
    //#endregion
  }
  if (__DEV__) {
    if (scopes.length !== 1) {
      return syntaxError("Missing parenthesis/bracket/brace", code, code.length - 1);
    }
  }
  return tokens;
};
