import { RuleTester } from "../../../test/rule-tester.ts";
import blankLineAfterBlock from "./blank-line-after-block.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("blank-lines/blank-line-after-block", blankLineAfterBlock, {
    valid: [
        "function restore(target, key, value) {\n    if (value === undefined) {\n        delete target[key].slot;\n        return;\n    }\n    target[key].slot = value;\n}\n",
        "function restore(target, value) {\n    if (value === undefined) {\n        delete target['slot'];\n        return;\n    }\n    target.slot = value;\n}\n",
        "function restore(target, value) {\n    if (value === undefined) {\n        delete target.slot;\n        return;\n    }\n\n    target.slot.child = value;\n}\n",
        "function collect(values) {\n    const result = [];\n    for (const value of values) {\n        if (!value.ready) continue;\n        result.push(value);\n    }\n\n    return result;\n}\n",
        "function collect(values, Map) {\n    const result = new Map();\n    for (const value of values) {\n        result.set(value.key, value);\n    }\n\n    return result;\n}\n",
        "function collect(values) {\n    const result = new Set();\n    for (const value of values) {\n        result.has(value);\n    }\n\n    return result;\n}\n",
        "function restore(target, value) {\n    if (value === undefined) {\n        delete target.slot;\n        return;\n    }\n\n    target.slot = value;\n}\n",
        "function collect(values) {\n    const result = [];\n    for (const value of values) {\n        if (value.ready) {\n            result.push(value);\n        }\n    }\n\n    return result;\n}\n",
        "function prepare(instance) {\n    const theme = instance.theme;\n    if (theme === undefined) {\n        return undefined;\n    }\n\n    if (alternate(instance)) {\n        return adapt(theme);\n    }\n\n    return theme;\n}\n",
        "function account(state, input) {\n    if (input.cached) {\n        state.hits += 1;\n        return;\n    }\n\n    state.attempts += 1;\n    work();\n}\n",
        "function restore(target, value) {\n    if (value === undefined) {\n        delete target.slot;\n        return;\n    }\n    target.slot = value;\n}\n",
        "function restore(target, other, value) {\n    if (value === undefined) {\n        delete target.slot;\n        return;\n    }\n\n    other.slot = value;\n}\n",
        "function restore(target, key, otherKey, value) {\n    if (value === undefined) {\n        delete target[key];\n        return;\n    }\n\n    target[otherKey] = value;\n}\n",
        {
            name: "preserves separation before returning an accumulated array",
            code: `function collect(values) {
    const result = [];
    for (const value of values) {
        result.push(value);
    }

    return result;
}
`,
        },
        {
            name: "preserves separation before returning a scalar total",
            code: `function total(values) {
    let total = 0;
    for (const value of values) {
        total += value;
    }

    return total;
}
`,
        },
        "function collect(values) {\n    const result = [];\n    for (const result of values) {\n        result.push(1);\n    }\n\n    return result;\n}\n",
        "function collect(values) {\n    const result = [];\n    for (const value of values) {\n        schedule(() => result.push(value));\n    }\n\n    return result;\n}\n",
        {
            name: "preserves separation before a bare return after a block",
            code: `function disable(state) {
    if (state.active) {
        restore(state.original);
    }

    return;
}
`,
        },
        {
            name: "keeps single-line boolean guards together",
            code: `function check(value) {
    if (value.a === undefined) return false;
    if (value.b === undefined) return false;
    return true;
}
`,
        },
        {
            name: "keeps single-line value guards together",
            code: `function parse(value, state) {
    if (value === undefined) return undefined;
    if (state === undefined) return undefined;
    return decode(value, state);
}
`,
        },
        {
            name: "keeps guards with wrapped conditions together",
            code: `function render(node, theme, context) {
    if (node === undefined) return undefined;
    if (node.hidden !== undefined && node.visible === undefined)
        return undefined;
    if (node.empty !== undefined && node.count === undefined)
        return undefined;

    return fallback(node, theme, context);
}
`,
        },
        {
            name: "allows a single-line update before a wrapped update",
            code: `function decode(source, state) {
    let node = init(source);
    if (source.text !== undefined) node = { ...node, text: source.text };
    if (source.preview !== undefined)
        node = { ...node, preview: decode(source.preview, state) };

    return node;
}
`,
        },
        {
            name: "preserves separation between a narrowing guard and a declaration",
            code: `function match(item) {
    if (!(item instanceof Item)) {
        return false;
    }

    const lines = item.render(1);
    return lines.length === 1;
}
`,
        },
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
        "function configure(env) {\n    if (shouldLog) {\n        env.LOG = '1';\n    }\n\n    if (hasJob) {\n        env.JOB = 'run';\n    }\n}\n",
    ],
    invalid: [
        {
            name: "separates a bare return from the preceding block",
            code: `function disable(state) {
    if (state.active) {
        restore(state.original);
    }
    return;
}
`,
            output: `function disable(state) {
    if (state.active) {
        restore(state.original);
    }

    return;
}
`,
            errors: [{ messageId: "expectedBlank" }],
        },
        ...[
            ["target.slot", "target.slot.child"],
            ["target.slot.child", "target.slot"],
            ["target[key]", "target[key].child"],
            ["target[key]", "target[otherKey]"],
            ["target[key()]", "target[key()]"],
        ].map(([deleted, assigned]) => ({
            code: `function restore(target, key, otherKey, value) {\n    if (value === undefined) {\n        delete ${deleted};\n        return;\n    }\n    ${assigned} = value;\n}\n`,
            output: `function restore(target, key, otherKey, value) {\n    if (value === undefined) {\n        delete ${deleted};\n        return;\n    }\n\n    ${assigned} = value;\n}\n`,
            errors: [{ messageId: "expectedBlank" }],
        })),
        {
            code: "function collect(values) {\n    const result = [];\n    for (const value of values) {\n        if (!value.ready) continue;\n        result.push(value);\n    }\n    return result;\n}\n",
            output: "function collect(values) {\n    const result = [];\n    for (const value of values) {\n        if (!value.ready) continue;\n        result.push(value);\n    }\n\n    return result;\n}\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            code: "function collect(values) {\n    const result = new Set();\n    for (const value of values) {\n        result.has(value);\n    }\n    return result;\n}\n",
            output: "function collect(values) {\n    const result = new Set();\n    for (const value of values) {\n        result.has(value);\n    }\n\n    return result;\n}\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            name: "keeps local failure accounting with the success branch",
            code: `function account(input) {
    let success = 0;
    let failure = 0;
    if (input.ready) {
        success += 1;
        return;
    }

    failure += 1;
}
`,
            output: `function account(input) {
    let success = 0;
    let failure = 0;
    if (input.ready) {
        success += 1;
        return;
    }
    failure += 1;
}
`,
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            code: "function total(values) {\n    let total = 0;\n    for (const value of values) {\n        consume(value);\n    }\n    return total;\n}\n",
            output: "function total(values) {\n    let total = 0;\n    for (const value of values) {\n        consume(value);\n    }\n\n    return total;\n}\n",
            errors: [{ messageId: "expectedBlank" }],
        },
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
        {
            name: "separates braced boolean guards",
            code: `function choose(item) {
    if (primary(item)) {
        return true;
    }
    if (secondary(item)) {
        return false;
    }

    return fallback(item);
}
`,
            output: `function choose(item) {
    if (primary(item)) {
        return true;
    }

    if (secondary(item)) {
        return false;
    }

    return fallback(item);
}
`,
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            name: "separates braced property updates",
            code: `function configure(target, input) {
    if (input.first) {
        target.first = input.first;
    }
    if (input.second) {
        target.second = input.second;
    }
}
`,
            output: `function configure(target, input) {
    if (input.first) {
        target.first = input.first;
    }

    if (input.second) {
        target.second = input.second;
    }
}
`,
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            name: "separates braced object reconstructions",
            code: `function build(input) {
    let result = {};
    if (input.first) {
        result = { ...result, first: input.first };
    }
    if (input.second) {
        result = { ...result, second: input.second };
    }

    return result;
}
`,
            output: `function build(input) {
    let result = {};
    if (input.first) {
        result = { ...result, first: input.first };
    }

    if (input.second) {
        result = { ...result, second: input.second };
    }

    return result;
}
`,
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            name: "separates wrapped object updates and their result",
            code: `function decode(source, state) {
    let node = init(source);
    if (source.body !== undefined)
        node = { ...node, body: decode(source.body, state) };
    if (source.preview !== undefined)
        node = { ...node, preview: decode(source.preview, state) };
    return node;
}
`,
            output: `function decode(source, state) {
    let node = init(source);
    if (source.body !== undefined)
        node = { ...node, body: decode(source.body, state) };

    if (source.preview !== undefined)
        node = { ...node, preview: decode(source.preview, state) };

    return node;
}
`,
            errors: [{ messageId: "expectedBlank" }, { messageId: "expectedBlank" }],
        },
        {
            name: "separates wrapped property updates and their result",
            code: `function decodePreview(value, state) {
    const preview = capture(value, state);
    if (preview.collapsed !== undefined)
        preview.collapsed = Math.trunc(preview.collapsed);
    if (preview.expanded !== undefined)
        preview.expanded = Math.trunc(preview.expanded);
    return preview;
}
`,
            output: `function decodePreview(value, state) {
    const preview = capture(value, state);
    if (preview.collapsed !== undefined)
        preview.collapsed = Math.trunc(preview.collapsed);

    if (preview.expanded !== undefined)
        preview.expanded = Math.trunc(preview.expanded);

    return preview;
}
`,
            errors: [{ messageId: "expectedBlank" }, { messageId: "expectedBlank" }],
        },
        {
            name: "separates a bare return from nested cleanup",
            code: `function configure(enabled, prototype, existingState) {
    if (!enabled) {
        if (existingState !== undefined) {
            restore(prototype, existingState);
        }
        return;
    }
}
`,
            output: `function configure(enabled, prototype, existingState) {
    if (!enabled) {
        if (existingState !== undefined) {
            restore(prototype, existingState);
        }

        return;
    }
}
`,
            errors: [{ messageId: "expectedBlank" }],
        },
    ],
});
