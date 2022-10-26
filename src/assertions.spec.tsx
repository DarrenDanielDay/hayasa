/// <reference path="./global.d.ts" />

import { Assert, React } from "./assertions";
import { LexicalScope, enterScope } from "./lexer";

describe("utils.ts", () => {
  describe("assert", () => {
    let errorSpy = jest.spyOn(console, "error");
    beforeEach(() => {
      errorSpy = jest.spyOn(console, "error");
      errorSpy.mockImplementation(() => {});
    });
    afterEach(() => {
      errorSpy.mockRestore();
    });
    it("should log error with failed assertion", () => {
      enterScope(LexicalScope.TopLevel);
      <Assert
        fn={function f() {}}
        {...{
          currentChar: "a",
          nextChar: () => false,
          expectScopes: [],
          excludeScopes: [LexicalScope.TopLevel],
        }}
      ></Assert>;
      expect(errorSpy).toBeCalledWith(`f: current char`);
    });

    it("should not work with production mode", () => {
      const isDev = globalThis.__DEV__;
      globalThis.__DEV__ = false;
      <Assert fn={function f() {}} currentChar="a"></Assert>;
      expect(errorSpy).not.toBeCalled();
      globalThis.__DEV__ = isDev;
    });
  });
});
