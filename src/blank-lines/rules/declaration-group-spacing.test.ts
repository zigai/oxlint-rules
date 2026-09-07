import { RuleTester } from "../../../test/rule-tester.ts";
import declarationGroupSpacing from "./declaration-group-spacing.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("blank-lines/declaration-group-spacing", declarationGroupSpacing, {
    valid: [
        "const first = {\n    mode: 'static',\n};\n\nconst second = {\n    enabled: true,\n};\n",
        "const value = read();\n\nconsume(items.map(value => value));\n",
        `
            const a = 1;
            const b = 2;
            consume(a, b);
        `,
        `
            const ready = check();
            if (ready) {
                run();
            }
        `,
    ],
    invalid: [
        {
            code: 'const KEY = Symbol.for("key");\n\nconst ENV = "ENV";\n\nconst OTHER = "OTHER";\n',
            output: 'const KEY = Symbol.for("key");\nconst ENV = "ENV";\nconst OTHER = "OTHER";\n',
            errors: [{ messageId: "unexpectedBlank" }, { messageId: "unexpectedBlank" }],
        },
        {
            code: "const rotatedPath = `${filePath}.1`;\n\nrmSync(rotatedPath, { force: true });\nrenameSync(filePath, rotatedPath);\n",
            output: "const rotatedPath = `${filePath}.1`;\nrmSync(rotatedPath, { force: true });\nrenameSync(filePath, rotatedPath);\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            options: [{ withinGroup: "never", compactRelatedUse: false }],
            code: "const a = 1;\n\nconst b = 2;\nconsume(a, b);\n",
            output: "const a = 1;\nconst b = 2;\n\nconsume(a, b);\n",
            errors: [{ messageId: "unexpectedBlank" }, { messageId: "expectedBlank" }],
        },
    ],
});
