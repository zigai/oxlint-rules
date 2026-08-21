import { RuleTester } from "../../../test/rule-tester.ts";

import { noUnknownParametersRule } from "./no-unknown-parameters.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
const allowInTypeGuards = [{ allowInTypeGuards: true }];

tester.run("antislop/no-unknown-parameters", noUnknownParametersRule, {
    valid: [
        "function enrich(cause: unknown): Error { return new Error(String(cause)); }",
        `
            declare const schema: { parse(value: unknown): string };
            function parseValue(input: unknown): string {
                return schema.parse(input);
            }
        `,
        `
            declare const schema: { safeParse(value: unknown): string };
            function decodeValue(input: unknown): string {
                return schema.safeParse(input);
            }
            function parseValue(input: unknown): string {
                return decodeValue(input);
            }
        `,
        `
            interface TypeBoxValidator {
                Parse(value: unknown): string;
            }
            declare const validator: TypeBoxValidator;
            function parseValue(input: unknown): string {
                return validator.Parse(input);
            }
        `,
        `
            type ZodParser = {
                parse: (value: unknown) => string;
            };
            declare const schema: ZodParser;
            function parseValue(input: unknown): string {
                return schema.parse(input);
            }
        `,
        `
            import { safeParse as parseValue } from "valibot";
            declare const schema: object;
            function decodeValue(input: unknown): object {
                return parseValue(schema, input);
            }
        `,
        `
            import { Value } from "typebox/value";
            declare const schema: object;
            function parseValue(input: unknown): string {
                const errors = [...Value.Errors(schema, input)];
                if (errors.length > 0) throw new Error("invalid");
                return Value.Parse(schema, input);
            }
        `,
        {
            code: `
                function isString(value: unknown): value is string {
                    return typeof value === "string";
                }
            `,
            options: allowInTypeGuards,
        },
        {
            code: `
                function assertString(value: unknown): asserts value is string {
                    if (typeof value !== "string") throw new Error();
                }
            `,
            options: allowInTypeGuards,
        },
        `
            const parser = {
                parse(value: unknown): string {
                    return String(value);
                },
            };
        `,
        `
            const parser = {
                parse: (value: unknown): string => String(value),
            };
        `,
    ],
    invalid: [
        {
            code: "function stringify(input: unknown): string { return String(input); }",
            errors: [{ messageId: "unknownParameter" }],
        },
        {
            code: `
                declare const schema: { parse(value: unknown): string };
                function isValue(input: unknown): input is string {
                    return schema.parse(input).length > 0;
                }
            `,
            errors: [{ messageId: "unknownParameter" }],
        },
        {
            code: `
                declare const schema: { parse(value: unknown): string };
                function parseValue(input: unknown): string {
                    console.log(input);
                    return schema.parse(input);
                }
            `,
            errors: [{ messageId: "unknownParameter" }],
        },
        {
            code: `
                import { safeParse as parseValue } from "not-valibot";
                declare const schema: object;
                function decodeValue(input: unknown): object {
                    return parseValue(schema, input);
                }
            `,
            errors: [{ messageId: "unknownParameter" }],
        },
        {
            code: `
                type Handler = (event: unknown) => void;
            `,
            errors: [{ messageId: "unknownParameter" }],
        },
        {
            code: `
                declare const validator: { Check(value: unknown): value is string };
                function parseValue(input: unknown): string | undefined {
                    return validator.Check(input) ? input : undefined;
                }
            `,
            errors: [{ messageId: "unknownParameter" }, { messageId: "unknownParameter" }],
        },
        {
            code: `
                import { safeParse } from "valibot";
                declare const schema: object;
                function decodeValue(input: unknown): object {
                    return safeParse(input, schema);
                }
            `,
            errors: [{ messageId: "unknownParameter" }],
        },
        {
            code: `
                const parser = {
                    parse(value: unknown) {
                        return String(value);
                    },
                };
            `,
            errors: [{ messageId: "unknownParameter" }],
        },
        {
            code: `
                import { Value } from "typebox/value";
                declare const schema: object;
                function checkValue(input: unknown): boolean {
                    return [...Value.Errors(schema, input)].length === 0;
                }
            `,
            errors: [{ messageId: "unknownParameter" }],
        },
    ],
});
