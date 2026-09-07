import { RuleTester } from "../../../test/rule-tester.ts";
import blankLineAfterBlock from "./blank-line-after-block.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("blank-lines/blank-line-after-block", blankLineAfterBlock, {
    valid: [
        "while (ready) {\n    if (skip) {\n        work();\n    }\n    break;\n}\n",
        "while (ready) {\n    if (skip) {\n        work();\n    }\n    continue;\n}\n",
        `
            if (ready) {
                run();
            }

            finish();
        `,
        `
            for (let i = 0; i < 10; i++) {
                work(i);
            }

            done();
        `,
    ],
    invalid: [
        {
            code: "if (ready) {\n    run();\n}\nfinish();\n",
            output: "if (ready) {\n    run();\n}\n\nfinish();\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            code: "while (pending) {\n    poll();\n}\ncomplete();\n",
            output: "while (pending) {\n    poll();\n}\n\ncomplete();\n",
            errors: [{ messageId: "expectedBlank" }],
        },
    ],
});
