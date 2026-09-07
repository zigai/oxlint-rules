import { RuleTester } from "../../../test/rule-tester.ts";
import blockBoundarySpacing from "./block-boundary-spacing.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("blank-lines/block-boundary-spacing", blockBoundarySpacing, {
    valid: [
        "function run() {\n    work();\n}\n",
        "class Worker {\n    start() {}\n}\n",
        "const fn = () => { doSomething(); };\n",
    ],
    invalid: [
        {
            code: "function run() {\n\n    work();\n\n}\n",
            output: "function run() {\n    work();\n}\n",
            errors: [{ messageId: "unexpectedAfterOpen" }, { messageId: "unexpectedBeforeClose" }],
        },
        {
            code: "class Worker {\n\n    work() {}\n\n}\n",
            output: "class Worker {\n    work() {}\n}\n",
            errors: [{ messageId: "unexpectedAfterOpen" }, { messageId: "unexpectedBeforeClose" }],
        },
    ],
});
