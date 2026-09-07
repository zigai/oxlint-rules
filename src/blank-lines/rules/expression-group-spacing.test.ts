import { RuleTester } from "../../../test/rule-tester.ts";
import expressionGroupSpacing from "./expression-group-spacing.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("blank-lines/expression-group-spacing", expressionGroupSpacing, {
    valid: [
        {
            options: [{ compactTryFinally: false }],
            code: "function decode(state, value) {\n    state.active.add(value);\n\n    try {\n        return decodeValue(value);\n    } finally {\n        state.active.delete(value);\n    }\n}\n",
        },
        `
            prepare();
            run();

            const done = true;
        `,
        `
            prepare();
            return done;
        `,
    ],
    invalid: [
        {
            options: [{ withinGroup: "never" }],
            code: "release(state);\n\ndelete state.cache;\n\nvoid finish();\n",
            output: "release(state);\ndelete state.cache;\nvoid finish();\n",
            errors: [{ messageId: "unexpectedBlank" }, { messageId: "unexpectedBlank" }],
        },
        {
            options: [{ groupByKind: true }],
            code: "void first();\nvoid second();\ndelete state.cache;\n",
            output: "void first();\nvoid second();\n\ndelete state.cache;\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            options: [{ withinGroup: "never" }],
            code: "prepare();\n\nrun();\nconst done = true;\n",
            output: "prepare();\nrun();\n\nconst done = true;\n",
            errors: [{ messageId: "unexpectedBlank" }, { messageId: "expectedBlank" }],
        },
    ],
});
