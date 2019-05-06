import { GraphQLSchema, DocumentNode, parse, validate } from "graphql";
import { compileQuery, isCompiledQuery } from "../execution";
import { makeExecutableSchema } from "graphql-tools";

describe("GraphQLJitResolveInfo", () => {
  describe("simple types", () => {
    let inf: any;
    const schema = makeExecutableSchema({
      typeDefs: `
        type Query {
          foo: Foo
        }
        type Foo {
          a: String
          b: Int
          c: Boolean!
          d: Bar
        }
        type Bar {
          e: String!
          f: Boolean!
        }
      `,
      resolvers: {
        Query: {
          foo(_: any, _1: any, _2: any, info: any) {
            inf = info;
          }
        }
      }
    });

    afterEach(() => {
      inf = undefined;
    });

    test("all selection fields of the current resolver", async () => {
      const result = await executeQuery(
        schema,
        parse(`query { foo { a d { e } } }`)
      );
      expect(result.errors).not.toBeDefined();
      expect(inf.fieldExpansion).toMatchInlineSnapshot(`
        Object {
          "Foo": Object {
            "a": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "d": Object {
              "Bar": Object {
                "e": Object {
                  Symbol(LeafFieldSymbol): true,
                },
              },
            },
          },
        }
      `);
    });

    test("with fragments", async () => {
      await executeQuery(
        schema,
        parse(
          `
          query {
            foo {
              ...fooFragment1
              a
              b
              ... on Foo {
                c
                ...fooFragment1
              }
            }
          }
          fragment fooFragment1 on Foo {
            a
            b
          }
          `
        )
      );

      expect(inf.fieldExpansion).toMatchInlineSnapshot(`
        Object {
          "Foo": Object {
            "a": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "b": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "c": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
        }
      `);
    });

    test("inline fragments", async () => {
      await executeQuery(
        schema,
        parse(
          `
          query {
            foo {
              ... {
                ... {
                  d {
                    ... {
                      e
                    }
                  }
                }
              }
            }
          }
          `
        )
      );

      expect(inf.fieldExpansion).toMatchInlineSnapshot(`
        Object {
          "Foo": Object {
            "d": Object {
              "Bar": Object {
                "e": Object {
                  Symbol(LeafFieldSymbol): true,
                },
              },
            },
          },
        }
      `);
    });

    test("aggregate multiple selections of the same field", async () => {
      await executeQuery(
        schema,
        parse(
          `
          query {
            foo {
              a
            }
            foo {
              b
            }
            foo {
              c
            }
          }
          `
        )
      );

      expect(inf.fieldExpansion).toMatchInlineSnapshot(`
        Object {
          "Foo": Object {
            "a": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "b": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "c": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
        }
      `);
    });
  });

  describe("interfaces", () => {
    let inf: any;
    const schema = makeExecutableSchema({
      typeDefs: `
        type Query {
          iBar: IBar
        }
        interface IBar {
          id: ID!
          title: String
        }
        type Bar1 implements IBar {
          id: ID!
          title: String
          b1: Int!
        }
        type Bar2 implements IBar {
          id: ID!
          title: String
          b2: Boolean!
        }
      `,
      resolvers: {
        Query: {
          iBar(_: any, _1: any, _2: any, info: any) {
            inf = info;
          }
        },
        IBar: {
          __resolveType() {
            return "Bar1";
          }
        }
      }
    });

    afterEach(() => {
      inf = undefined;
    });

    test("compute interface field nodes", async () => {
      const result = await executeQuery(
        schema,
        parse(
          `
            query {
              iBar {
                id
                title
              }
            }
          `
        )
      );

      expect(result.errors).not.toBeDefined();

      expect(inf.fieldExpansion).toMatchInlineSnapshot(`
        Object {
          "Bar1": Object {
            "id": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "title": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
          "Bar2": Object {
            "id": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "title": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
          "IBar": Object {
            "id": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "title": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
        }
      `);
    });

    test("fields per type", async () => {
      const result = await executeQuery(
        schema,
        parse(
          `
            query {
              iBar {
                id
                title
                ... on Bar1 {
                  b1
                }
                ... on Bar2 {
                  b2
                }
              }
            }
          `
        )
      );
      expect(result.errors).not.toBeDefined();
      expect(inf.fieldExpansion).toMatchInlineSnapshot(`
        Object {
          "Bar1": Object {
            "b1": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "id": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "title": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
          "Bar2": Object {
            "b2": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "id": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "title": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
          "IBar": Object {
            "id": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "title": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
        }
      `);
    });

    test("fields per type - with fragments", async () => {
      const result = await executeQuery(
        schema,
        parse(
          `
            query {
              iBar {
                id
                title
                ... on Bar1 {
                  b1
                  ...bar1
                }
                ... on Bar2 {
                  b2
                }
                ...bar2
              }
            }
            fragment bar1 on Bar1 {
              id
              b1
            }
            fragment bar2 on Bar2 {
              title
              b2
            }
          `
        )
      );

      expect(result.errors).not.toBeDefined();
      expect(inf.fieldExpansion).toMatchInlineSnapshot(`
        Object {
          "Bar1": Object {
            "b1": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "id": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "title": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
          "Bar2": Object {
            "b2": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "id": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "title": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
          "IBar": Object {
            "id": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "title": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
        }
      `);
    });

    test("aggregate multiple selections of the same field", async () => {
      const result = await executeQuery(
        schema,
        parse(
          `
            query {
              iBar {
                id
              }
              iBar {
                title
              }
              iBar {
                ... on Bar1 {
                  b1
                }
              }
              iBar {
                ... on Bar2 {
                  b2
                }
              }
            }
          `
        )
      );

      expect(result.errors).not.toBeDefined();

      expect(inf.fieldExpansion).toMatchInlineSnapshot(`
        Object {
          "Bar1": Object {
            "b1": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "id": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "title": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
          "Bar2": Object {
            "b2": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "id": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "title": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
          "IBar": Object {
            "id": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "title": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
        }
      `);
    });
  });

  describe("unions", () => {
    let inf: any;
    const schema = makeExecutableSchema({
      typeDefs: `
        type Query {
          uBaz: Baz
        }
        union Baz = Foo | Bar
        type Foo {
          foo: String
        }
        type Bar {
          bar: Int
        }
      `,
      resolvers: {
        Query: {
          uBaz(_: any, _1: any, _2: any, info: any) {
            inf = info;
          }
        },
        Baz: {
          __resolveType() {
            return "Foo";
          }
        }
      }
    });

    afterEach(() => {
      inf = undefined;
    });

    test("union field nodes", async () => {
      const result = await executeQuery(
        schema,
        parse(
          `
            query {
              uBaz {
                ... on Foo {
                  foo
                }
                ... on Bar {
                  bar
                }
              }
            }
          `
        )
      );

      expect(result.errors).not.toBeDefined();
      expect(inf.fieldExpansion).toMatchInlineSnapshot(`
        Object {
          "Bar": Object {
            "bar": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
          "Foo": Object {
            "foo": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
        }
      `);
    });

    test("__typename", async () => {
      const result = await executeQuery(
        schema,
        parse(`
          query {
            uBaz {
              __typename
              alias: __typename
            }
          }
        `)
      );
      expect(result.errors).not.toBeDefined();
      expect(inf.fieldExpansion).toMatchInlineSnapshot(`
        Object {
          "Bar": Object {},
          "Foo": Object {},
        }
      `);
    });

    test("unions with fragments", async () => {
      const result = await executeQuery(
        schema,
        parse(
          `
            query {
              uBaz {
                ...foo
                ...bar
              }
            }
            fragment foo on Foo {
              foo
            }
            fragment bar on Bar {
              bar
            }
          `
        )
      );

      expect(result.errors).not.toBeDefined();
      expect(inf.fieldExpansion).toMatchInlineSnapshot(`
        Object {
          "Bar": Object {
            "bar": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
          "Foo": Object {
            "foo": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
        }
      `);
    });

    test("aggregate multiple selections of the same field", async () => {
      const result = await executeQuery(
        schema,
        parse(
          `
            query {
              uBaz {
                ...bar
              }
              ... {
                uBaz {
                  ...foo
                }
              }
            }
            fragment foo on Foo {
              foo
            }
            fragment bar on Bar {
              bar
            }
          `
        )
      );

      expect(result.errors).not.toBeDefined();
      expect(inf.fieldExpansion).toMatchInlineSnapshot(`
        Object {
          "Bar": Object {
            "bar": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
          "Foo": Object {
            "foo": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
        }
      `);
    });
  });

  describe("lists, inputs, unions and interfaces 2", () => {
    let infNode: any;
    let infElements: any;
    let infMedia: any;
    const schema = makeExecutableSchema({
      typeDefs: `
        type Query {
          node(id: ID!): Node!
          elements(like: String!): [DocumentElement!]!
          media(tags: [String!]!): [Media!]!
        }
        interface Node {
          id: ID!
        }
        interface Media {
          url: String!
          tags: [Tag!]
        }
        type Tag implements Node {
          id: ID!
          name: String!
        }
        union DocumentElement = Image | Video | Div
        type Div {
          children: [DocumentElement!]
        }
        type Image implements Node & Media {
          id: ID!
          url: String!
          tags: [Tag!]
          width: Int
        }
        type Video implements Node & Media {
          id: ID!
          url: String!
          tags: [Tag!]
          source: VideoSource
        }
        enum VideoSource {
          YOUTUBE
          VIMEO
        }
      `,
      resolvers: {
        Query: {
          node(_: any, { id }: any, _2: any, info: any) {
            infNode = info;
            return {
              id,
              url: "https://example.com",
              children: [],
              width: 50
            };
          },
          elements(_: any, _1: any, _2: any, info: any) {
            infElements = info;
            return [];
          },
          media(_: any, _1: any, _2: any, info: any) {
            infMedia = info;
            return [];
          }
        },
        Node: {
          __resolveType() {
            return "Image";
          }
        },
        Media: {
          __resolveType() {
            return "Video";
          }
        },
        DocumentElement: {
          __resolveType() {
            return "Div";
          }
        }
      }
    });

    afterEach(() => {
      infNode = undefined;
      infElements = undefined;
      infMedia = undefined;
    });

    test("node", async () => {
      const doc = parse(`
        query {
          node(id: "root") {
            id
            ... on Image {
              width
            }
            ... on DocumentElement {
              __typename
              ... on Image {
                url
                tags {
                  name
                }
              }
              ... on Media {
                tags {
                  id
                }
              }
            }
          }
        }
      `);
      const result = await executeQuery(schema, doc);
      const validationErrors = validate(schema, doc);
      if (validationErrors.length > 0) {
        console.error(validationErrors);
      }
      expect(validationErrors.length).toBe(0);
      expect(result.errors).not.toBeDefined();
      expect(infNode.fieldExpansion).toMatchInlineSnapshot(`
        Object {
          "Image": Object {
            "id": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "tags": Object {
              "Tag": Object {
                "id": Object {
                  Symbol(LeafFieldSymbol): true,
                },
                "name": Object {
                  Symbol(LeafFieldSymbol): true,
                },
              },
            },
            "url": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "width": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
          "Media": Object {
            "tags": Object {
              "Tag": Object {
                "id": Object {
                  Symbol(LeafFieldSymbol): true,
                },
                "name": Object {
                  Symbol(LeafFieldSymbol): true,
                },
              },
            },
            "url": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
          "Node": Object {
            "id": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
          "Tag": Object {
            "id": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
          "Video": Object {
            "id": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "tags": Object {
              "Tag": Object {
                "id": Object {
                  Symbol(LeafFieldSymbol): true,
                },
                "name": Object {
                  Symbol(LeafFieldSymbol): true,
                },
              },
            },
            "url": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
        }
      `);
    });

    test("elements", async () => {
      const doc = parse(`
        query {
          elements(like: "div") {
            __typename
            ... on Node {
              id
            }
            ... on Media {
              url
            }
            ... on Div {
              children {
                ... on Node {
                  id
                }
                ...mediaContainer
              }
            }
          }
        }
        fragment mediaContainer on Div {
          children {
            ... on Media {
              url
            }
          }
        }
      `);
      const result = await executeQuery(schema, doc);
      const validationErrors = validate(schema, doc);
      if (validationErrors.length > 0) {
        console.error(validationErrors);
      }
      expect(validationErrors.length).toBe(0);

      expect(result.errors).not.toBeDefined();
      expect(infElements.fieldExpansion).toMatchInlineSnapshot(`
        Object {
          "Div": Object {
            "children": Object {
              "Div": Object {
                "children": Object {
                  "Div": Object {},
                  "Image": Object {
                    "url": Object {
                      Symbol(LeafFieldSymbol): true,
                    },
                  },
                  "Media": Object {
                    "url": Object {
                      Symbol(LeafFieldSymbol): true,
                    },
                  },
                  "Node": Object {},
                  "Video": Object {
                    "url": Object {
                      Symbol(LeafFieldSymbol): true,
                    },
                  },
                },
              },
              "Image": Object {
                "id": Object {
                  Symbol(LeafFieldSymbol): true,
                },
              },
              "Media": Object {},
              "Node": Object {
                "id": Object {
                  Symbol(LeafFieldSymbol): true,
                },
              },
              "Video": Object {
                "id": Object {
                  Symbol(LeafFieldSymbol): true,
                },
              },
            },
          },
          "Image": Object {
            "id": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "url": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
          "Media": Object {
            "url": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
          "Node": Object {
            "id": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
          "Video": Object {
            "id": Object {
              Symbol(LeafFieldSymbol): true,
            },
            "url": Object {
              Symbol(LeafFieldSymbol): true,
            },
          },
        }
      `);
    });
  });
});

function executeQuery(
  schema?: GraphQLSchema,
  document?: DocumentNode,
  rootValue?: any,
  contextValue?: any,
  variableValues?: any,
  operationName?: string
) {
  const prepared: any = compileQuery(
    schema as any,
    document as any,
    operationName || ""
  );
  if (!isCompiledQuery(prepared)) {
    return prepared;
  }
  return prepared.query(rootValue, contextValue, variableValues || {});
}
