/// <reference path="./global.d.ts" />

import { assert } from "./util";

describe("utils.ts", () => {
  describe("assert", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    beforeEach(() => {
      errorSpy.mockReset();
    });
    afterEach(() => {
      errorSpy.mockRestore();
    });
    it("should log error with failed assertion", () => {
      assert({
        fn: function f() {},
        err: false,
      });
      expect(errorSpy).toBeCalledWith(`f: err`);
      assert({
        fn: function f() {},
        err2: () => false,
      });
      expect(errorSpy).toBeCalledWith(`f: err2`);
    });

    it("should not work with production mode", () => {
      const isDev = globalThis.__DEV__;
      globalThis.__DEV__ = false;
      assert({
        fn: function f() {},
        err: false,
      });
      expect(errorSpy).not.toBeCalled();
      globalThis.__DEV__ = isDev;
    });
  });
});
