import { charRange, syntaxError, toMap } from "./util";

describe("utils.ts", () => {
  describe("char range", () => {
    it("should generate chars in range with both `begin` and `end` included", () => {
      expect(charRange("a", "a")).toStrictEqual(["a"]);
      expect(charRange("0", "9")).toStrictEqual([..."0123456789"]);
    });
  });
  describe("to map", () => {
    it("should generate mapping object for key query", () => {
      expect(toMap(["a", "b", "c"])).toStrictEqual({ a: true, b: true, c: true });
    });
  });

  describe("syntax error", () => {
    it("should point out the position where error occurs", () => {
      expect(() => { 
        syntaxError(``,`// ignored
const export = 1;
// ignored`, 17)
       }).toThrow(`
const export = 1;
      ^`)
    }) 
  });
});
