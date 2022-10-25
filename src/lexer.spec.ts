import {
  cleanUp,
  initCode,
  cursor,
  code,
  skipCommentAndBlanks,
  hasNewline,
  readWord,
  enterScope,
  LexicalScope,
  singleQuoteScope,
  tokens,
  doubleQuoteScope,
} from "./lexer";
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
  });

  describe("single quote literal", () => {
    beforeEach(() => {
      cleanUp();
    });
    it("should include escape chars", () => {
      initCode("'I \\'m writing this parser!' // Some comment");
      enterScope(LexicalScope.SingleQuoteLiteral);
      singleQuoteScope();
      expect(tokens.at(-1)!.content).toBe("'I \\'m writing this parser!'");
    });
  });

  describe("double quote literal", () => {
    beforeEach(() => {
      cleanUp();
    });
    it("should include escape chars", () => {
      initCode('"I \\\'m \\"writing\\" this parser!" // Some comment');
      enterScope(LexicalScope.DoubleQuoteLiteral);
      doubleQuoteScope();
      expect(tokens.at(-1)!.content).toBe('"I \\\'m \\"writing\\" this parser!"');
    });
  });
});
