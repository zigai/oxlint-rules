import { RuleTester } from "../../../test/rule-tester.ts";

import { noUnknownParametersRule } from "./no-unknown-parameters.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("antislop/no-unknown-parameters", noUnknownParametersRule, {
    valid: [
        "function enrich(cause: unknown): Error { return new Error(String(cause)); }",
        `
            declare const schema: { parse(value: object): string };
            function parseValue(input: unknown): string {
                return schema.parse(input);
            }
        `,
        `
            declare const schema: { safeParse(value: object): string };
            function decodeValue(input: unknown): string {
                return schema.safeParse(input);
            }
            function parseValue(input: unknown): string {
                return decodeValue(input);
            }
        `,
    ],
    invalid: [
        {
            code: "function stringify(input: unknown): string { return String(input); }",
            errors: [{ messageId: "unknownParameter" }],
        },
        {
            code: `
                declare const schema: { parse(value: object): string };
                function isValue(input: unknown): input is string {
                    return schema.parse(input).length > 0;
                }
            `,
            errors: [{ messageId: "unknownParameter" }],
        },
        {
            code: `
                declare const schema: { parse(value: object): string };
                function parseValue(input: unknown): string {
                    console.log(input);
                    return schema.parse(input);
                }
            `,
            errors: [{ messageId: "unknownParameter" }],
        },
    ],
});
