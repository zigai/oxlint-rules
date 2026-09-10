import { RuleTester } from "../../../test/rule-tester.ts";
import blankLineBeforeExit from "./blank-line-before-exit.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("blank-lines/blank-line-before-exit", blankLineBeforeExit, {
    valid: [
        "function factory() {\n    const first = load();\n    const unused = load();\n    const last = load();\n\n    return () => combine(first, last);\n}\n",
        {
            name: "allows a return immediately after a single-line guard",
            code: `function render(item, fallback) {
    if (item === undefined) return fallback;
    return transform(item);
}
`,
        },
        "function factory() {\n    const first = load();\n    const unused = load();\n    const last = load();\n    return (first) => combine(first, last);\n}\n",
        "function factory() {\n    const first = load();\n    const unused = load();\n    const last = load();\n    return () => combine(() => first, last);\n}\n",
        "function factory() {\n    const first = load();\n    consume(first);\n    const last = load();\n    return () => combine(first, last);\n}\n",
        ...[
            ["new Set()", "result.has(value)"],
            ["load()", "result.add(value)"],
            ["{ add(value) {} }", "result.add(value)"],
            ["new Set()", "result.unknown(value)"],
        ].map(
            ([initializer, operation]) =>
                `function collect(values) {\n    const result = ${initializer};\n    for (const value of values) {\n        ${operation};\n    }\n\n    return result;\n}\n`,
        ),
        {
            name: "preserves separation before returning a scalar accumulator",
            code: `function total(values) {
    let total = 0;
    for (const value of values) {
        total += value;
    }

    return total;
}
`,
        },
        {
            name: "preserves separation before returning nested-loop results",
            code: `function collect(groups) {
    const result = [];
    for (const group of groups) {
        for (const value of group) {
            result.push(value);
        }
    }

    return result;
}
`,
        },
        {
            name: "leaves bare-return spacing after a guard to the after-block rule",
            code: `function disable(state) {
    if (state.active) {
        restore(state.original);
    }

    return;
}
`,
        },
        {
            name: "preserves separation before returning collected values",
            code: `function collect(values) {
    const result = [];
    for (const value of values) {
        result.push(value);
    }

    return result;
}
`,
        },
        "function collect(values, Set) {\n    const result = new Set();\n    for (const value of values) {\n        result.add(value);\n    }\n\n    return result;\n}\n",
        "function collect(values) {\n    let result = [];\n    result = load();\n    for (const value of values) {\n        result.push(value);\n    }\n\n    return result;\n}\n",
        "function collect(values) {\n    const result = [];\n    for (const value of values) {\n        if (!value.ready) continue;\n        result.push(value);\n    }\n\n    return result;\n}\n",
        "function collect(values) {\n    const result = [];\n    for (const valuesOfItem of values) {\n        inner: for (const value of valuesOfItem) {\n            if (!value.ready) continue inner;\n            result.push(value);\n        }\n    }\n\n    return result;\n}\n",
        "function collect(values) {\n    const result = [];\n    outer: for (const valuesOfItem of values) {\n        for (const value of valuesOfItem) {\n            if (!value.ready) continue outer;\n            result.push(value);\n        }\n    }\n\n    return result;\n}\n",
        "function collect(values) {\n    const result = [];\n    for (const value of values) {\n        value.ready && result.push(value);\n    }\n\n    return result;\n}\n",
        "function factory() {\n    const first = load();\n    const second = load();\n\n    return () => combine(first, second);\n}\n",
        "function factory() {\n    const value = load();\n\n    return (value) => consume(value);\n}\n",
        "function factory() {\n    const value = load();\n\n    return () => () => consume(value);\n}\n",
        "function factory() {\n    const value = load();\n\n    return { run() { return consume(value); } };\n}\n",
        "function disable(state) {\n    if (state.active) {\n        state.enabled = false;\n        if (state.wrapper === state.current) {\n            state.current = state.original;\n            delete state.wrapper;\n        }\n    }\n    return;\n}\n",
        "function build(input) {\n    let result = {};\n    if (input.first) {\n        result = { ...result, first: input.first };\n    }\n    if (input.second) {\n        result = { ...result, second: input.second };\n    }\n\n    return result;\n}\n",
        "function total(values) {\n    let total = 0;\n    for (let total of values) {\n        total += 1;\n    }\n\n    return total;\n}\n",
        {
            languageOptions: { parserOptions: { lang: "tsx" } },
            code: `function Input({ id, name, type, className, ...props }) {
    const fallbackID = useId();
    const resolvedID = id ?? fallbackID;

    return (
        <input
            type={type}
            id={resolvedID}
            name={name ?? resolvedID}
            data-slot="input"
            className={cn("base", "focus", "invalid", className)}
            aria-describedby={resolvedID}
            {...props}
        />
    );
}
`,
        },
        {
            code: "function result() {\n    const value = read();\n\n    return [\n        value, value, value, value, value, value, value, value,\n        value, value, value, value, value, value, value, value,\n        value, value, value, value, value, value, value, value,\n        value, value, value, value, value, value, value, value,\n    ];\n}\n",
        },
        {
            options: [{ compactShortBodies: false, compactErrorHandlers: false }],
            code: "try {\n    work();\n} catch (cause) {\n    capture(cause);\n\n    throw cause;\n}\n",
        },
        {
            options: [{ compactShortBodies: false, compactWrappedDeclarations: false }],
            code: "function run(state) {\n    const value =\n        state.value ?? fallback();\n\n    return value;\n}\n",
        },
        `
            function small() {
                return 42;
            }
        `,
        `
            function run() {
                prepare();
                return 42;
            }
        `,
        `
            function process(val: number) {
                if (val < 0) {
                    throw new Error("negative");
                }

                work();
            }
        `,
        {
            name: "allows a captured result after a guard with intervening setup",
            code: `function take(captured, schema) {
    const checked = check(schema, captured);
    const extra = loadExtra(checked);
    if (!checked) return reject();
    return captured;
}
`,
        },
        {
            name: "allows a computed result after a guard with intervening setup",
            code: `function shouldCache(toolName) {
    const normalized = normalize(toolName);
    const extra = loadExtra(normalized);
    if (normalized === "apply_patch") return false;
    return normalized !== "edit";
}
`,
        },
    ],
    invalid: [
        ...[
            ["[]", "result.push(value)"],
            ["new Set()", "result.add(value)"],
            ["new Map()", "result.set(value.key, value)"],
        ].map(([initializer, operation]) => ({
            name: `separates a ${initializer} accumulation loop from its return`,
            code: `function collect(values) {
    const result = ${initializer};
    for (const value of values) {
        ${operation};
    }
    return result;
}
`,
            output: `function collect(values) {
    const result = ${initializer};
    for (const value of values) {
        ${operation};
    }

    return result;
}
`,
            errors: [{ messageId: "expectedBlank" }],
        })),
        {
            name: "separates a scalar accumulation loop from its return",
            code: `function total(values) {
    let total = 0;
    for (const value of values) {
        total += value;
    }
    return total;
}
`,
            output: `function total(values) {
    let total = 0;
    for (const value of values) {
        total += value;
    }

    return total;
}
`,
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            code: "function factory() {\n    const first = load();\n    const unused = load();\n    const last = load();\n    return () => combine(first, last);\n}\n",
            output: "function factory() {\n    const first = load();\n    const unused = load();\n    const last = load();\n\n    return () => combine(first, last);\n}\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            name: "keeps a returned closure with the binding it captures",
            code: `function factory() {
    const unused = load();
    const value = load();

    return () => consume(value);
}
`,
            output: `function factory() {
    const unused = load();
    const value = load();
    return () => consume(value);
}
`,
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            code: "function factory() {\n    const value = load();\n\n    return () => consume(value);\n}\n",
            output: "function factory() {\n    const value = load();\n    return () => consume(value);\n}\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            name: "keeps a bare return with straight-line cleanup",
            code: `function reset(state) {
    state.enabled = false;
    state.options = undefined;
    clear();
    state.cache = new Map();
    state.cache.clear();

    return;
}
`,
            output: `function reset(state) {
    state.enabled = false;
    state.options = undefined;
    clear();
    state.cache = new Map();
    state.cache.clear();
    return;
}
`,
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            code: "function result() {\n    const value = read();\n\n    return combine(\n        value,\n        fallback,\n    );\n}\n",
            output: "function result() {\n    const value = read();\n    return combine(\n        value,\n        fallback,\n    );\n}\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            options: [{ compactShortBodies: false }],
            code: "try {\n    work();\n} catch (cause) {\n    capture(cause);\n\n    throw cause;\n}\n",
            output: "try {\n    work();\n} catch (cause) {\n    capture(cause);\n    throw cause;\n}\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            options: [{ compactShortBodies: false }],
            code: "function run(state) {\n    const value =\n        state.value ?? fallback();\n\n    return value;\n}\n",
            output: "function run(state) {\n    const value =\n        state.value ?? fallback();\n    return value;\n}\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        ...["break", "continue", "break outer", "continue outer"].map((jump) => ({
            code: `outer: while (ready) {\n    if (skip) {\n        work();\n    }\n\n    ${jump};\n}\n`,
            output: `outer: while (ready) {\n    if (skip) {\n        work();\n    }\n    ${jump};\n}\n`,
            errors: [{ messageId: "unexpectedJumpBlank" }],
        })),
        {
            code: "while (ready) {\n    try {\n        work();\n    } finally {\n        cleanup();\n    }\n\n    break;\n}\n",
            output: "while (ready) {\n    try {\n        work();\n    } finally {\n        cleanup();\n    }\n    break;\n}\n",
            errors: [{ messageId: "unexpectedJumpBlank" }],
        },
        {
            code: 'function normalize(text) {\n    const neutralized = clean(text);\n\n    return neutralized.includes("\\t") ? expand(neutralized) : neutralized;\n}\n',
            output: 'function normalize(text) {\n    const neutralized = clean(text);\n    return neutralized.includes("\\t") ? expand(neutralized) : neutralized;\n}\n',
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            code: "function configure(enabled) {\n    if (current === enabled) {\n        return false;\n    }\n\n    current = enabled;\n\n    return true;\n}\n",
            output: "function configure(enabled) {\n    if (current === enabled) {\n        return false;\n    }\n\n    current = enabled;\n    return true;\n}\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            code: "while (ready) {\n    if (skip) {\n        index += 2;\n\n        continue;\n    }\n}\n",
            output: "while (ready) {\n    if (skip) {\n        index += 2;\n        continue;\n    }\n}\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            options: [{ compactShortBodies: false }],
            code: "function value() {\n    prepare();\n    return 42;\n}\n",
            output: "function value() {\n    prepare();\n\n    return 42;\n}\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            options: [{ compactShortBodies: false }],
            code: "function check() {\n    setup();\n    throw new Error();\n}\n",
            output: "function check() {\n    setup();\n\n    throw new Error();\n}\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            name: "separates a returned value from conditional updates",
            code: `function preview(record, action) {
    if (record.path !== undefined) action = { ...action, path: record.path };
    if (record.limit !== undefined) action = { ...action, limit: record.limit };
    return action;
}
`,
            output: `function preview(record, action) {
    if (record.path !== undefined) action = { ...action, path: record.path };
    if (record.limit !== undefined) action = { ...action, limit: record.limit };

    return action;
}
`,
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            name: "separates a derived total from its accumulation loop",
            code: `function size(lines) {
    let bytes = 0;
    for (const line of lines) {
        bytes += Buffer.byteLength(line);
    }
    return bytes;
}
`,
            output: `function size(lines) {
    let bytes = 0;
    for (const line of lines) {
        bytes += Buffer.byteLength(line);
    }

    return bytes;
}
`,
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            name: "separates a constructed fallback from a single-line guard",
            code: `function header(server) {
    const prefix = loadPrefix();
    const suffix = loadSuffix(prefix);
    if (server !== undefined) return { label: "Status", body: server };
    return { label: "Status", body: undefined };
}
`,
            output: `function header(server) {
    const prefix = loadPrefix();
    const suffix = loadSuffix(prefix);
    if (server !== undefined) return { label: "Status", body: server };

    return { label: "Status", body: undefined };
}
`,
            errors: [{ messageId: "expectedBlank" }],
        },
    ],
});
