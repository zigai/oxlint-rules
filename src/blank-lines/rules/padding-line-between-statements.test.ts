import { RuleTester } from "../../../test/rule-tester.ts";
import paddingLineBetweenStatements from "./padding-line-between-statements.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("blank-lines/padding-line-between-statements", paddingLineBetweenStatements, {
    valid: [
        {
            code: `
                function value() {
                    const answer = 42;

                    return answer;
                }
            `,
            options: [
                {
                    pairs: [{ blankLine: "always", prev: "const", next: "return" }],
                },
            ],
        },
    ],
    invalid: [
        {
            code: "function value() {\n    const answer = 42;\n    return answer;\n}\n",
            output: "function value() {\n    const answer = 42;\n\n    return answer;\n}\n",
            options: [
                {
                    pairs: [
                        { blankLine: "never", prev: "*", next: "return" },
                        { blankLine: "always", prev: "const", next: "return" },
                    ],
                },
            ],
            errors: [{ messageId: "expectedBlank" }],
        },
    ],
});
