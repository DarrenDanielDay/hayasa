import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { cwd } from "process";
import {
  cleanUp,
  initCode,
  cursor,
  code,
  skipCommentAndBlanks,
  hasNewline,
  readWord,
  singleQuoteScope,
  tokens,
  doubleQuoteScope,
  readNumericLiteral,
  readTemplateLiteral,
  readRegExpLiteral,
  readPunctuator,
  setCursor,
  tokenize,
  enterScope,
  LexicalScope,
  LexicalToken,
  readTokens,
  LexicalType,
  stringify,
} from "./lexer";

function testFile(name: string): string {
  return join(cwd(), "test-code", name);
}
function lexerFile(name: string) {
  return readFile(testFile(name), { encoding: "utf-8" });
}
function lexerOutput(tokens: LexicalToken[], name: string) {
  return writeFile(testFile(name), tokens.map((t) => t.content).join(" "));
}

describe("lexer.ts", () => {
  describe("skip comment and blanks", () => {
    beforeEach(() => {
      cleanUp();
    });
    it("should skip single line comment", () => {
      initCode(`
      // should be skipped
      // should also be skipped 
      /NOTSKIPPED`);
      skipCommentAndBlanks();
      expect(hasNewline).toBe(true);
      expect(code.slice(cursor)).toBe("/NOTSKIPPED");
    });
    it("should skip multiple line comment", () => {
      initCode(`
      /** 
       * multiple line comments
       * 
       * should be "skipped
       */
    RestStart`);
      skipCommentAndBlanks();
      expect(hasNewline).toBe(true);
      expect(code.slice(cursor)).toBe("RestStart");
    });
    it("should skip multiple line comment but no newline marked", () => {
      initCode(`/** * multiple line comments should be "skipped*/ RestStart`);
      skipCommentAndBlanks();
      expect(hasNewline).toBe(false);
      expect(code.slice(cursor)).toBe("RestStart");
    });
    it("altogether", () => {
      initCode(`\
// should be skipped
/* *******  //
 should be skipped */  // should be skipped
  // should be skipped
  should not be skipped`);
      skipCommentAndBlanks();
      expect(hasNewline).toBe(true);
      expect(code.slice(cursor)).toBe("should not be skipped");
    });
  });

  describe("read word", () => {
    beforeEach(() => {
      cleanUp();
    });
    it("should read word only", () => {
      initCode(`Hello, world!`);
      const word = readWord();
      expect(word).toBe("Hello");
      expect(code.slice(cursor)).toBe(", world!");
    });
    it("should read private field", () => {
      initCode(`\
class A {
  #foo = 1;
}
`);
      setCursor(12);
      const word = readWord();
      expect(word).toBe("#foo");
    });
  });

  describe("single quote literal", () => {
    beforeEach(() => {
      cleanUp();
    });
    it("should include escape chars", () => {
      initCode("'I \\'m writing \\u0061 parser!' // Some comment");
      singleQuoteScope();
      expect(tokens.at(-1)!.content).toBe("'I \\'m writing \\u0061 parser!'");
    });
  });

  describe("double quote literal", () => {
    beforeEach(() => {
      cleanUp();
    });
    it("should include escape chars", () => {
      initCode('"I \\\'m \\"writing\\" \\x61 parser!" // Some comment');
      doubleQuoteScope();
      expect(tokens.at(-1)!.content).toBe('"I \\\'m \\"writing\\" \\x61 parser!"');
    });
  });

  describe("numeric literal", () => {
    beforeEach(() => {
      cleanUp();
    });
    it("should read binary literal", () => {
      initCode("0b101010101111_0_1.toFixed(2)");
      const numLiteral = readNumericLiteral();
      expect(numLiteral).toBe("0b101010101111_0_1");
      expect(code.slice(cursor)).toBe(".toFixed(2)");
    });
    it("should read octal literal", () => {
      initCode("0o12_36_7_512673516.toFixed(2)");
      const numLiteral = readNumericLiteral();
      expect(numLiteral).toBe("0o12_36_7_512673516");
      expect(code.slice(cursor)).toBe(".toFixed(2)");
    });
    it("should read hexadecimal", () => {
      initCode("0x78e9_723f60abc.toFixed(2)");
      const numLiteral = readNumericLiteral();
      expect(numLiteral).toBe("0x78e9_723f60abc");
      expect(code.slice(cursor)).toBe(".toFixed(2)");
    });
    it("should read decimal without float point", () => {
      initCode("178_93_46128936 .toFixed(2)");
      const numLiteral = readNumericLiteral();
      expect(numLiteral).toBe("178_93_46128936");
      expect(code.slice(cursor)).toBe(" .toFixed(2)");
    });
    it("should read decimal with float point", () => {
      initCode("192873_0.1129_2.toFixed(2)");
      const numLiteral = readNumericLiteral();
      expect(numLiteral).toBe("192873_0.1129_2");
      expect(code.slice(cursor)).toBe(".toFixed(2)");
    });
    it("should read simplified float", () => {
      initCode(".1962.toFixed(2)");
      const numLiteral = readNumericLiteral();
      expect(numLiteral).toBe(".1962");
      expect(code.slice(cursor)).toBe(".toFixed(2)");
    });
    it("should read decimal and exp", () => {
      initCode("1e9_8.toFixed(2)");
      const numLiteral = readNumericLiteral();
      expect(numLiteral).toBe("1e9_8");
      expect(code.slice(cursor)).toBe(".toFixed(2)");
    });
    it("should read decimal and exp with signs", () => {
      initCode("1E+9_8.toFixed(2)");
      const numLiteral = readNumericLiteral();
      expect(numLiteral).toBe("1E+9_8");
      expect(code.slice(cursor)).toBe(".toFixed(2)");
      cleanUp();
      initCode("20_22E-9_8.toFixed(2)");
      const numLiteral2 = readNumericLiteral();
      expect(numLiteral2).toBe("20_22E-9_8");
      expect(code.slice(cursor)).toBe(".toFixed(2)");
    });
    it("should read leagacy octal", () => {
      initCode("01271623.toFixed(2)");
      const numLiteral = readNumericLiteral();
      expect(numLiteral).toBe("01271623");
      expect(code.slice(cursor)).toBe(".toFixed(2)");
    });
    it("should work altogether", () => {
      initCode("17_162.8_92E-9_8.toFixed(2)");
      const numLiteral = readNumericLiteral();
      expect(numLiteral).toBe("17_162.8_92E-9_8");
      expect(code.slice(cursor)).toBe(".toFixed(2)");
    });
  });

  describe("template literal", () => {
    beforeEach(() => {
      cleanUp();
    });
    it("should read template with expression opening punctuator ${", () => {
      initCode("some template \\${ $\\{ ${1 + 2} after that`");
      enterScope(LexicalScope.TemplateLiteral);
      const template = readTemplateLiteral();
      expect(template).toBe("some template \\${ $\\{ ${");
    });
    it("should read template with trailing `", () => {
      initCode(" after that`");
      enterScope(LexicalScope.TemplateLiteral);
      const template = readTemplateLiteral();
      expect(template).toBe(" after that`");
    });
    it("should include escaped sequence \\`", () => {
      initCode("Template with escaped grave accent punctuator \\` some other text` // not included ");
      enterScope(LexicalScope.TemplateLiteral);
      const template = readTemplateLiteral();
      expect(template).toBe("Template with escaped grave accent punctuator \\` some other text`");
    });
    it("should read part after template interpolation", () => {
      initCode("`a ${b} c`");
      setCursor(6);
      enterScope(LexicalScope.TemplateLiteral);
      const template = readTemplateLiteral();
      expect(template).toBe("} c`");
    });
  });

  describe("regular expression literal", () => {
    beforeEach(() => {
      cleanUp();
    });
    it("should read regular expression literal", () => {
      initCode("/[a-z]\\//i;");
      const regexLiteral = readRegExpLiteral();
      expect(regexLiteral).toBe("/[a-z]\\//i");
      expect(code.slice(cursor)).toBe(";");
    });
    it("should work with regular expression without flag", () => {
      initCode("/[a-z]\\//;");
      const regexLiteral = readRegExpLiteral();
      expect(regexLiteral).toBe("/[a-z]\\//");
      expect(code.slice(cursor)).toBe(";");
    });
  });

  describe("punctuator", () => {
    beforeEach(() => {
      cleanUp();
    });
    it("should handle optional chain", () => {
      initCode("var x = null; x?.toString()");
      setCursor(15);
      const operator = readPunctuator();
      expect(operator).toBe("?.");
      expect(code.slice(cursor)).toBe("toString()");
    });
    it("should handle conditional expression with numerical literal", () => {
      initCode("true?.0:1");
      setCursor(4);
      const operator = readPunctuator();
      expect(operator).toBe("?");
      expect(code.slice(cursor)).toBe(".0:1");
    });
    it("should read longest match", () => {
      initCode("1===+1");
      setCursor(1);
      const operator = readPunctuator();
      expect(operator).toBe("===");
      expect(code.slice(cursor)).toBe("+1");
    });
  });
  describe("tokenize", () => {
    it("should parse this content", async () => {
      const content = await lexerFile("lexer.js");
      let tokens: LexicalToken[] = [];
      expect(() => {
        tokens = tokenize(content);
      }).not.toThrow();
      expect(readTokens()).toBe(tokens);
      expect(tokens.find((t) => t.content === "for" && t.type === LexicalType.Reserved)).toBeFalsy();
      await lexerOutput(tokens, "lexer-output.js");
    }, 1000);
    it("should parse react dom umd", async () => {
      const content = await lexerFile("react-dom.production.min.js");
      let tokens: LexicalToken[] = [];
      expect(() => {
        tokens = tokenize(content);
      }).not.toThrow();
      expect(readTokens()).toBe(tokens);
      await lexerOutput(tokens, "react-dom-parsed.js");
    });
    it("should emit syntax error under dev mode when parenthesis/bracket/brace does not match", () => {
      expect(() => {
        tokenize(`const x = []};`);
      }).toThrow(SyntaxError);
      expect(() => {
        tokenize(`const x = [;`);
      }).toThrow(SyntaxError);
    });
    it("should cover regexp as first token", () => {
      expect(() => {
        tokenize('/ak+q/i.test("akkq")');
      }).not.toThrow();
    });
  });
  describe("stringify", () => {
    it("should render code", () => {
      const tokens = tokenize("const a=1+2;");
      const code = stringify(tokens);
      expect(code).toBe("const a = 1 + 2 ;");
    });
  });
});
