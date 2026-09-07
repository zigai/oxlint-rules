import { RuleTester } from "../../../test/rule-tester.ts";
import controlFlowCuddling from "./control-flow-cuddling.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("blank-lines/control-flow-cuddling", controlFlowCuddling, {
    valid: [
        {
            options: [{ compactRelatedControlFlow: false }],
            code: "function select(value) {\n    if (value === 1) {\n        return 1;\n    }\n\n    if (value === 2) {\n        return 2;\n    }\n}\n",
        },
        "const unrelated = read();\nconst ready = check();\nif (ready) {\n    run();\n}\n",
        "let ready;\nlet unrelated = read();\nready = check();\nif (ready) {\n    run();\n}\n",
        "const ready = check();\nif (ready) {\n    run();\n}\n",
        "const start = getStart();\nfor (let i = start; i < 10; i++) {\n    visit(i);\n}\n",
        "const result = load();\nif (enabled) {\n    consume(result);\n}\n",
        "const value = read();\n\nif (other) {\n    run();\n}\n",
    ],
    invalid: [
        {
            code: "const value = read();\nif (items.some(value => value.ready)) {\n    work();\n}\n",
            output: "const value = read();\n\nif (items.some(value => value.ready)) {\n    work();\n}\n",
            errors: [{ messageId: "unrelated" }],
        },
        {
            code: "const value = read();\nfor (const value of items) {\n    consume(value);\n}\n",
            output: "const value = read();\n\nfor (const value of items) {\n    consume(value);\n}\n",
            errors: [{ messageId: "unrelated" }],
        },
        {
            code: "const value = read();\nif (ready) {\n    run();\n}\n",
            output: "const value = read();\n\nif (ready) {\n    run();\n}\n",
            errors: [{ messageId: "unrelated" }],
        },
        {
            code: "prepare();\nif (ready) {\n    run();\n}\n",
            output: "prepare();\n\nif (ready) {\n    run();\n}\n",
            errors: [{ messageId: "unrelated" }],
        },
        {
            options: [{ maxCuddledStatements: 1 }],
            code: "const a = 1;\nconst b = 2;\nif (a < b) {\n    run();\n}\n",
            output: "const a = 1;\nconst b = 2;\n\nif (a < b) {\n    run();\n}\n",
            errors: [{ messageId: "tooMany" }],
        },
    ],
});
