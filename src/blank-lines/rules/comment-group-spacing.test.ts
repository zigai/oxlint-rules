import { RuleTester } from "../../../test/rule-tester.ts";
import commentGroupSpacing from "./comment-group-spacing.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("blank-lines/comment-group-spacing", commentGroupSpacing, {
    valid: [
        "function run() {\n    // explanation\n    work();\n}\n",
        "const width =\n    count +\n    // Extra padding.\n    2;\n",
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
            options: [{ afterLine: "always" }],
            code: "work();\n// explanation\nnext();\n",
            output: "work();\n\n// explanation\n\nnext();\n",
            errors: [{ messageId: "expectedBefore" }, { messageId: "expectedAfter" }],
        },
    ],
});
