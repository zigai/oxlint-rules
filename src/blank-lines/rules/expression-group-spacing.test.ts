import { RuleTester } from "../../../test/rule-tester.ts";
import expressionGroupSpacing from "./expression-group-spacing.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("blank-lines/expression-group-spacing", expressionGroupSpacing, {
    valid: [
        "function run(input) {\n    release(input);\n\n    const size = measure(input);\n    if (ready) return;\n\n    consume(input);\n}\n",
        {
            name: "preserves explicit spacing when a returned closure shadows the capture",
            options: [{ beforeGroup: "always" }],
            code: `function prepare(theme, count) {
    count += 1;

    const saved = capture(theme);

    patch(theme);

    return (saved) => restore(theme, saved);
}
`,
        },
        "function clear(editor) {\n    const redraw = editor.visible;\n    clearUi();\n\n    if (redraw) {\n        editor.render();\n    }\n}\n",
        {
            name: "allows a single-line conditional update before a call",
            code: `function walk(statement, indent, depth) {
    if (index > 0) this.add(statement.pos, indent);
    this.walkNode(statement, indent, depth);
}
`,
        },
        {
            name: "keeps loop work with a continue filter",
            code: `while (ready) {
    if (skip) continue;
    work();
}
`,
        },
        {
            name: "allows consecutive calls with expression-bodied callbacks",
            code: `function trace(logger, snapshot) {
    logger.record('start', () => ({
        phase: 'start',
    }));
    logger.record('stop', () => ({
        phase: 'stop',
    }));
}
`,
        },
        {
            name: "keeps consecutive single-line calls together",
            code: `function boot() {
    prepare();
    run();
}
`,
        },
        {
            name: "keeps a multiline call with a consumer of its receiver",
            code: `function collect(lineIndex, rows, lineRows) {
    lineRows.push({
        start: 0,
        end: 1,
    });
    rows.set(lineIndex, lineRows);
}
`,
        },
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
        {
            name: "keeps single-line assertions compact with declarations",
            code: `function process(path, options) {
    const requested = resolve(path);
    options.signal?.throwIfAborted();
    const file = open(requested);
    return file;
}
`,
        },
        {
            name: "keeps same-receiver calls and declarations compact",
            code: `function run(service, pi) {
    service.cancel();
    const pending = service.drain();
    service.reset();
    service.persist(pi);
}
`,
        },
    ],
    invalid: [
        {
            name: "separates a guard from a preceding call",
            code: `function clear(editor) {
    const redraw = editor.visible;
    clearUi();
    if (redraw) {
        editor.render();
    }
}
`,
            output: `function clear(editor) {
    const redraw = editor.visible;
    clearUi();

    if (redraw) {
        editor.render();
    }
}
`,
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            name: "separates a completed call from the following declaration",
            code: `function run(input) {
    release(input);
    const size = measure(input);
    if (size > limit) return;

    consume(input);
}
`,
            output: `function run(input) {
    release(input);

    const size = measure(input);
    if (size > limit) return;

    consume(input);
}
`,
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            options: [{ beforeGroup: "always" }],
            code: "function prepare(theme, count) {\n    count += 1;\n\n    const saved = capture(theme);\n\n    patch(theme);\n\n    return () => restore(theme, saved);\n}\n",
            output: "function prepare(theme, count) {\n    count += 1;\n    const saved = capture(theme);\n    patch(theme);\n\n    return () => restore(theme, saved);\n}\n",
            errors: [{ messageId: "unexpectedBlank" }, { messageId: "unexpectedBlank" }],
        },
        {
            name: "compacts declaration setup while separating the following guard",
            options: [{ beforeGroup: "always" }],
            code: `function clear(editor) {
    const redraw = editor.visible;

    clearUi();
    if (redraw) {
        editor.render();
    }
}
`,
            output: `function clear(editor) {
    const redraw = editor.visible;
    clearUi();

    if (redraw) {
        editor.render();
    }
}
`,
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
            name: "separates an early-exit guard from a following call",
            code: `function check(value, state) {
    if (!Guard.isObject(value)) return reject();
    state.active.add(value);
}
`,
            output: `function check(value, state) {
    if (!Guard.isObject(value)) return reject();

    state.active.add(value);
}
`,
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            name: "separates a conditional call from a multiline assignment",
            code: `function schedule() {
    if (syntaxTimer !== undefined) clearTimeout(syntaxTimer);
    pendingStart = {
        generation: generation(),
    };
}
`,
            output: `function schedule() {
    if (syntaxTimer !== undefined) clearTimeout(syntaxTimer);

    pendingStart = {
        generation: generation(),
    };
}
`,
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            name: "separates registrations with loops in their handlers",
            code: `function listen(pi) {
    pi.on('start', (event) => {
        for (const message of event.messages) {
            show(message);
        }
    });
    pi.on('stop', (event) => {
        for (const message of event.messages) {
            hide(message);
        }
    });
}
`,
            output: `function listen(pi) {
    pi.on('start', (event) => {
        for (const message of event.messages) {
            show(message);
        }
    });

    pi.on('stop', (event) => {
        for (const message of event.messages) {
            hide(message);
        }
    });
}
`,
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            name: "separates registrations with simple block-bodied handlers",
            code: `function listen(pi) {
    pi.on('start', () => {
        show('start');
    });
    pi.on('stop', () => {
        show('stop');
    });
}
`,
            output: `function listen(pi) {
    pi.on('start', () => {
        show('start');
    });

    pi.on('stop', () => {
        show('stop');
    });
}
`,
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            name: "separates a multiline call from an independent call",
            code: `function apply(nextConfig) {
    configureCache(
        nextConfig.cache,
        nextConfig.limits,
    );
    applyConfig(nextConfig);
}
`,
            output: `function apply(nextConfig) {
    configureCache(
        nextConfig.cache,
        nextConfig.limits,
    );

    applyConfig(nextConfig);
}
`,
            errors: [{ messageId: "expectedBlank" }],
        },
    ],
});
