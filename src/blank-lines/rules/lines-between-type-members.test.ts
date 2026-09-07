import { RuleTester } from "../../../test/rule-tester.ts";
import linesBetweenTypeMembers from "./lines-between-type-members.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("blank-lines/lines-between-type-members", linesBetweenTypeMembers, {
    valid: [
        `
            interface User {
                id: string;
                name: string;
            }
        `,
        `
            enum Status {
                Ready,
                Done,
            }
        `,
    ],
    invalid: [
        {
            code: "enum Status {\n    Ready,\n\n    Done,\n}\n",
            output: "enum Status {\n    Ready,\n    Done,\n}\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
    ],
});
