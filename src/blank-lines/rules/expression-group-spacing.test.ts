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
        "function clear(editor) {\n    const redraw = editor.visible;\n    clearUi();\n\n    if (redraw) {\n        editor.render();\n    }\n}\n",
        "function walk(statement, indent, depth) {\n    if (index > 0) this.add(statement.pos, indent);\n    this.walkNode(statement, indent, depth);\n}\n",
        "while (ready) {\n    if (skip) continue;\n    work();\n}\n",
        "function trace(logger, snapshot) {\n    logger.record('start', () => ({\n        phase: 'start',\n    }));\n    logger.record('stop', () => ({\n        phase: 'stop',\n    }));\n}\n",
        "function boot() {\n    prepare();\n    run();\n}\n",
        "function collect(lineIndex, rows, lineRows) {\n    lineRows.push({\n        start: 0,\n        end: 1,\n    });\n    rows.set(lineIndex, lineRows);\n}\n",
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
            code: "function clear(editor) {\n    const redraw = editor.visible;\n    clearUi();\n    if (redraw) {\n        editor.render();\n    }\n}\n",
            output: "function clear(editor) {\n    const redraw = editor.visible;\n    clearUi();\n\n    if (redraw) {\n        editor.render();\n    }\n}\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            code: "function run(input) {\n    release(input);\n    const size = measure(input);\n    if (size > limit) return;\n\n    consume(input);\n}\n",
            output: "function run(input) {\n    release(input);\n\n    const size = measure(input);\n    if (size > limit) return;\n\n    consume(input);\n}\n",
            errors: [{ messageId: "expectedBlank" }],
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
            output: "function clear(editor) {\n    const redraw = editor.visible;\n    clearUi();\n\n    if (redraw) {\n        editor.render();\n    }\n}\n",
            errors: [{ messageId: "unexpectedBlank" }, { messageId: "expectedBlank" }],
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
        {
            code: "function check(value, state) {\n    if (!Guard.isObject(value)) return reject();\n    state.active.add(value);\n}\n",
            output: "function check(value, state) {\n    if (!Guard.isObject(value)) return reject();\n\n    state.active.add(value);\n}\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            code: "function schedule() {\n    if (syntaxTimer !== undefined) clearTimeout(syntaxTimer);\n    pendingStart = {\n        generation: generation(),\n    };\n}\n",
            output: "function schedule() {\n    if (syntaxTimer !== undefined) clearTimeout(syntaxTimer);\n\n    pendingStart = {\n        generation: generation(),\n    };\n}\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            code: "function listen(pi) {\n    pi.on('start', (event) => {\n        for (const message of event.messages) {\n            show(message);\n        }\n    });\n    pi.on('stop', (event) => {\n        for (const message of event.messages) {\n            hide(message);\n        }\n    });\n}\n",
            output: "function listen(pi) {\n    pi.on('start', (event) => {\n        for (const message of event.messages) {\n            show(message);\n        }\n    });\n\n    pi.on('stop', (event) => {\n        for (const message of event.messages) {\n            hide(message);\n        }\n    });\n}\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            code: "function listen(pi) {\n    pi.on('start', () => {\n        show('start');\n    });\n    pi.on('stop', () => {\n        show('stop');\n    });\n}\n",
            output: "function listen(pi) {\n    pi.on('start', () => {\n        show('start');\n    });\n\n    pi.on('stop', () => {\n        show('stop');\n    });\n}\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            code: "function apply(nextConfig) {\n    configureCache(\n        nextConfig.cache,\n        nextConfig.limits,\n    );\n    applyConfig(nextConfig);\n}\n",
            output: "function apply(nextConfig) {\n    configureCache(\n        nextConfig.cache,\n        nextConfig.limits,\n    );\n\n    applyConfig(nextConfig);\n}\n",
            errors: [{ messageId: "expectedBlank" }],
        },
    ],
});
