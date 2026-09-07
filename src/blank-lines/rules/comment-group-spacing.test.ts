import { RuleTester } from "../../../test/rule-tester.ts";
import commentGroupSpacing from "./comment-group-spacing.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("blank-lines/comment-group-spacing", commentGroupSpacing, {
    valid: [
        {
            code: "work();\n/* eslint-disable-line no-console */\nnext();\n",
            options: [{ beforeBlock: "always", afterBlock: "always" }],
        },
        "work();\n// Explains the following directive.\n// @ts-expect-error\nbroken();\n",
        "function run() {\n    // explanation\n    work();\n}\n",
        "const width =\n    count +\n    // Extra padding.\n    2;\n",
        "switch (value) {\ncase 1:\n    // explanation\n    work();\n    break;\n}\n",
        "switch (value) {\ndefault:\n    /* explanation */\n    work();\n}\n",
        "switch (value) {\ncase 1:\n    // fall through\ncase 2:\n    work();\n}\n",
        "switch (value) {\ncase (ready ? one : two):\n    // explanation\n    work();\n}\n",
        "const value = ready ? one :\n    // Expression-internal comment.\n    two;\n",
        {
            code: "const width =\n    count +\n    // Extra padding.\n    2;\n",
            options: [{ afterLine: "always" }],
        },
        `
            work();

            // explanation
            // continued

            next();
        `,
        `
            // @ts-expect-error
            broken();
        `,
        `
            /**
             * JSDoc documentation
             */
            function run() {}
        `,
    ],
    invalid: [
        {
            code: "work();\n/* eslint-disable-next-line no-console */\nconsole.log(value);\n",
            output: "work();\n\n/* eslint-disable-next-line no-console */\nconsole.log(value);\n",
            options: [{ afterBlock: "always" }],
            errors: [{ messageId: "expectedBefore" }],
        },
        {
            code: "work();\n/* oxlint-disable-next-line no-console */\nconsole.log(value);\n",
            output: "work();\n\n/* oxlint-disable-next-line no-console */\nconsole.log(value);\n",
            options: [{ afterBlock: "always" }],
            errors: [{ messageId: "expectedBefore" }],
        },
        {
            code: "function first() {}\n/** Describes the next function. */\nexport function second() {}\n",
            output: "function first() {}\n\n/** Describes the next function. */\nexport function second() {}\n",
            options: [{ afterBlock: "always" }],
            errors: [{ messageId: "expectedBefore" }],
        },
        {
            code: "work();\n// @ts-expect-error -- expected failure\nbroken();\n",
            output: "work();\n\n// @ts-expect-error -- expected failure\nbroken();\n",
            options: [{ afterLine: "always" }],
            errors: [{ messageId: "expectedBefore" }],
        },
        {
            code: "switch (value) {\ncase 1:\n    work();\n    // explanation\n    next();\n}\n",
            output: "switch (value) {\ncase 1:\n    work();\n\n    // explanation\n    next();\n}\n",
            errors: [{ messageId: "expectedBefore" }],
        },
        {
            code: "switch (value) {\ncase 1:\n    // explanation\n    work();\n}\n",
            options: [{ allowAtBlockBoundary: false }],
            output: "switch (value) {\ncase 1:\n\n    // explanation\n    work();\n}\n",
            errors: [{ messageId: "expectedBefore" }],
        },
        {
            code: "switch (value) {\ndefault:\n    /* explanation */\n    work();\n}\n",
            options: [{ allowAtBlockBoundary: false }],
            output: "switch (value) {\ndefault:\n\n    /* explanation */\n    work();\n}\n",
            errors: [{ messageId: "expectedBefore" }],
        },
        {
            code: "switch (value) {\ncase 1:\n    // explanation\n    work();\n}\n",
            options: [{ afterLine: "always" }],
            output: "switch (value) {\ncase 1:\n    // explanation\n\n    work();\n}\n",
            errors: [{ messageId: "expectedAfter" }],
        },
        {
            options: [{ afterLine: "always" }],
            code: "work();\n// explanation\nnext();\n",
            output: "work();\n\n// explanation\n\nnext();\n",
            errors: [{ messageId: "expectedBefore" }, { messageId: "expectedAfter" }],
        },
    ],
});
