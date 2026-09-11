import { RuleTester } from "../../../test/rule-tester.ts";
import switchCaseSpacing from "./switch-case-spacing.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("blank-lines/switch-case-spacing", switchCaseSpacing, {
    valid: [
        "switch (value) {\n    case 1:\n        work();\n\n        return;\n    case 2:\n        return;\n}\n",
        {
            options: [{ longCase: "always", shortCase: "any" }],
            code: `
            switch (value) {
                case 1:
                    first();
                    second();
                    third();
                    break;

                case 2:
                    next();
                    break;
            }
        `,
        },
        `
            switch (value) {
                case 1:
                case 2:
                    run();
            }
        `,
        {
            options: [{ default: "always" }],
            code: "switch (value) {\n    case 1:\n        return 1;\n\n    case 2:\n        return 2;\n}\n",
        },
    ],
    invalid: [
        {
            code: "switch (value) {\n    case 1: {\n        const item = read();\n        process(item);\n        return item;\n    }\n\n    case 2:\n        return;\n\n    default:\n        return;\n}\n",
            output: "switch (value) {\n    case 1: {\n        const item = read();\n        process(item);\n        return item;\n    }\n    case 2:\n        return;\n    default:\n        return;\n}\n",
            errors: [{ messageId: "unexpectedBlank" }, { messageId: "unexpectedBlank" }],
        },
        {
            options: [{ longCase: "always", shortCase: "any" }],
            code: "switch (value) {\n    case 1:\n        first();\n        second();\n        third();\n        break;\n    case 2:\n        next();\n        break;\n}\n",
            output: "switch (value) {\n    case 1:\n        first();\n        second();\n        third();\n        break;\n\n    case 2:\n        next();\n        break;\n}\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            code: "switch (value) {\n    case 1:\n\n    case 2:\n        run();\n}\n",
            output: "switch (value) {\n    case 1:\n    case 2:\n        run();\n}\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            options: [{ default: "always" }],
            code: "switch (value) {\n    case 1:\n        return 1;\n    case 2:\n        return 2;\n}\n",
            output: "switch (value) {\n    case 1:\n        return 1;\n\n    case 2:\n        return 2;\n}\n",
            errors: [{ messageId: "expectedBlank" }],
        },
    ],
});
