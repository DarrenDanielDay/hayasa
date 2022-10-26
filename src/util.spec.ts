import { charRange, toMap } from "./util";

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
});
