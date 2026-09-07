import { RuleTester } from "../../../test/rule-tester.ts";
import linesBetweenClassMembers from "./lines-between-class-members.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("blank-lines/lines-between-class-members", linesBetweenClassMembers, {
    valid: [
        `
            class Worker {
                start() {}

                stop() {}
            }
        `,
        {
            code: "class Point {\n    x = 0;\n    y = 0;\n}\n",
            options: [
                {
                    default: "always",
                    pairs: [{ blankLine: "never", prev: "field", next: "field" }],
                },
            ],
        },
    ],
    invalid: [
        {
            code: "class Worker {\n    start() {}\n    stop() {}\n}\n",
            output: "class Worker {\n    start() {}\n\n    stop() {}\n}\n",
            errors: [{ messageId: "expectedBlank" }],
        },
    ],
});
