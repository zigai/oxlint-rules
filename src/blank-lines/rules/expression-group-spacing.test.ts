import { RuleTester } from "../../../test/rule-tester.ts";
import expressionGroupSpacing from "./expression-group-spacing.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("blank-lines/expression-group-spacing", expressionGroupSpacing, {
    valid: [
        "function run(input) {\n    release(input);\n\n    const size = measure(input);\n    if (ready) return;\n\n    consume(input);\n}\n",
        {
            options: [{ beforeGroup: "always" }],
            code: "function prepare(theme, count) {\n    count += 1;\n\n    const saved = capture(theme);\n\n    patch(theme);\n\n    return (saved) => restore(theme, saved);\n}\n",
        },
        "function clear(editor) {\n    const redraw = editor.visible;\n    clearUi();\n    if (redraw) {\n        editor.render();\n    }\n}\n",
        "function clear(editor) {\n    const redraw = editor.visible;\n    clearUi();\n\n    if (redraw) {\n        editor.render();\n    }\n}\n",
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
            code: "function run(input) {\n    release(input);\n\n    const size = measure(input);\n\n    if (size > limit) return;\n\n    consume(input);\n}\n",
            output: "function run(input) {\n    release(input);\n    const size = measure(input);\n\n    if (size > limit) return;\n\n    consume(input);\n}\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            options: [{ beforeGroup: "always" }],
            code: "function prepare(theme, count) {\n    count += 1;\n\n    const saved = capture(theme);\n\n    patch(theme);\n\n    return () => restore(theme, saved);\n}\n",
            output: "function prepare(theme, count) {\n    count += 1;\n    const saved = capture(theme);\n    patch(theme);\n\n    return () => restore(theme, saved);\n}\n",
            errors: [{ messageId: "unexpectedBlank" }, { messageId: "unexpectedBlank" }],
        },
        {
            options: [{ beforeGroup: "always" }],
            code: "function clear(editor) {\n    const redraw = editor.visible;\n\n    clearUi();\n    if (redraw) {\n        editor.render();\n    }\n}\n",
            output: "function clear(editor) {\n    const redraw = editor.visible;\n    clearUi();\n    if (redraw) {\n        editor.render();\n    }\n}\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
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
