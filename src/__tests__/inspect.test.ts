/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import inspect, { nodejsCustomInspectSymbol } from "../inspect";

describe("inspect", () => {
  it("undefined", () => {
    expect(inspect(undefined)).toEqual("undefined");
  });

  it("null", () => {
    expect(inspect(null)).toEqual("null");
  });

  it("boolean", () => {
    expect(inspect(true)).toEqual("true");
    expect(inspect(false)).toEqual("false");
  });

  it("string", () => {
    expect(inspect("")).toEqual('""');
    expect(inspect("abc")).toEqual('"abc"');
    // $FlowFixMe
    expect(inspect('"')).toEqual(String.raw`"\""`);
  });

  it("number", () => {
    expect(inspect(0.0)).toEqual("0");
    expect(inspect(3.14)).toEqual("3.14");
    expect(inspect(NaN)).toEqual("NaN");
    expect(inspect(Infinity)).toEqual("Infinity");
    expect(inspect(-Infinity)).toEqual("-Infinity");
  });

  it("function", () => {
    expect(inspect(() => 0)).toEqual("[function]");

    function testFunc() {}
    expect(inspect(testFunc)).toEqual("[function testFunc]");
  });

  it("array", () => {
    expect(inspect([])).toEqual("[]");
    expect(inspect([null])).toEqual("[null]");
    expect(inspect([1, NaN])).toEqual("[1, NaN]");
    expect(inspect([["a", "b"], "c"])).toEqual('[["a", "b"], "c"]');

    expect(inspect([[[]]])).toEqual("[[[]]]");
    expect(inspect([[["a"]]])).toEqual("[[[Array]]]");

    expect(inspect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual(
      "[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]"
    );

    expect(inspect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual(
      "[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, ... 1 more item]"
    );

    expect(inspect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).toEqual(
      "[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, ... 2 more items]"
    );
  });

  it("object", () => {
    expect(inspect({})).toEqual("{}");
    expect(inspect({ a: 1 })).toEqual("{ a: 1 }");
    expect(inspect({ a: 1, b: 2 })).toEqual("{ a: 1, b: 2 }");
    expect(inspect({ array: [null, 0] })).toEqual("{ array: [null, 0] }");

    expect(inspect({ a: { b: {} } })).toEqual("{ a: { b: {} } }");
    expect(inspect({ a: { b: { c: 1 } } })).toEqual("{ a: { b: [Object] } }");

    const map = Object.create(null);
    map["a"] = true;
    map["b"] = null;
    expect(inspect(map)).toEqual("{ a: true, b: null }");
  });

  it("custom inspect", () => {
    const object = {
      inspect() {
        return "<custom inspect>";
      }
    };

    expect(inspect(object)).toEqual("<custom inspect>");
  });

  it("custom inspect that return `this` should work", () => {
    const object = {
      inspect() {
        return this;
      }
    };

    expect(inspect(object)).toEqual("{ inspect: [function inspect] }");
  });

  it("custom symbol inspect is take precedence", () => {
    const object = {
      inspect() {
        return "<custom inspect>";
      },
      [String(nodejsCustomInspectSymbol)]() {
        return "<custom symbol inspect>";
      }
    };

    expect(inspect(object)).toEqual("<custom symbol inspect>");
  });

  it("custom inspect returning object values", () => {
    const object = {
      inspect() {
        return { custom: "inspect" };
      }
    };

    expect(inspect(object)).toEqual('{ custom: "inspect" }');
  });

  it("custom inspect function that uses this", () => {
    const object = {
      str: "Hello World!",
      inspect() {
        return this.str;
      }
    };

    expect(inspect(object)).toEqual("Hello World!");
  });

  it("detect circular objects", () => {
    const obj: any = {};
    obj.self = obj;
    obj.deepSelf = { self: obj };

    expect(inspect(obj)).toEqual(
      "{ self: [Circular], deepSelf: { self: [Circular] } }"
    );

    const array: any = [];
    array[0] = array;
    array[1] = [array];

    expect(inspect(array)).toEqual("[[Circular], [[Circular]]]");

    const mixed: any = { array: [] };
    mixed.array[0] = mixed;

    expect(inspect(mixed)).toEqual("{ array: [[Circular]] }");

    const customA = {
      inspect: () => customB
    };

    const customB = {
      inspect: () => customA
    };

    expect(inspect(customA)).toEqual("[Circular]");
  });

  it("Use class names for the shortform of an object", () => {
    class Foo {
      foo: string;

      constructor() {
        this.foo = "bar";
      }
    }

    expect(inspect([[new Foo()]])).toEqual("[[[Foo]]]");

    (Foo.prototype as any)[Symbol.toStringTag] = "Bar";
    expect(inspect([[new Foo()]])).toEqual("[[[Bar]]]");
  });
});
