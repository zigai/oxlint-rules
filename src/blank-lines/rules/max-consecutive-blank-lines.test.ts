import { RuleTester } from "../../../test/rule-tester.ts";
import maxConsecutiveBlankLines from "./max-consecutive-blank-lines.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("blank-lines/max-consecutive-blank-lines", maxConsecutiveBlankLines, {
    valid: ["const a = 1;\n\nconst b = 2;\n", "const text = `first\n\n\nsecond`;\n"],
    invalid: [
        {
            code: "const a = 1;\n\n\n\nconst b = 2;\n",
            output: "const a = 1;\n\nconst b = 2;\n",
            errors: [{ messageId: "tooMany" }],
        },
    ],
});
