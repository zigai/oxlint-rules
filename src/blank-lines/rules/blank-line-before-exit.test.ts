import { RuleTester } from "../../../test/rule-tester.ts";
import blankLineBeforeExit from "./blank-line-before-exit.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("blank-lines/blank-line-before-exit", blankLineBeforeExit, {
    valid: [
        "function factory() {\n    const first = load();\n    const unused = load();\n    const last = load();\n\n    return () => combine(first, last);\n}\n",
        "function render(item, fallback) {\n    if (item === undefined) return fallback;\n    return transform(item);\n}\n",
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
        "function total(values) {\n    let total = 0;\n    for (const value of values) {\n        total += value;\n    }\n\n    return total;\n}\n",
        "function collect(groups) {\n    const result = [];\n    for (const group of groups) {\n        for (const value of group) {\n            result.push(value);\n        }\n    }\n\n    return result;\n}\n",
        // The rule abstains here: a bare return after a block is spaced by the after-block rule.
        "function disable(state) {\n    if (state.active) {\n        restore(state.original);\n    }\n\n    return;\n}\n",
        "function collect(values) {\n    const result = [];\n    for (const value of values) {\n        result.push(value);\n    }\n\n    return result;\n}\n",
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
        "function take(captured, schema) {\n    const checked = check(schema, captured);\n    const extra = loadExtra(checked);\n    if (!checked) return reject();\n    return captured;\n}\n",
        'function shouldCache(toolName) {\n    const normalized = normalize(toolName);\n    const extra = loadExtra(normalized);\n    if (normalized === "apply_patch") return false;\n    return normalized !== "edit";\n}\n',
    ],
    invalid: [
        ...[
            ["[]", "result.push(value)"],
            ["new Set()", "result.add(value)"],
            ["new Map()", "result.set(value.key, value)"],
        ].map(([initializer, operation]) => ({
            code: `function collect(values) {\n    const result = ${initializer};\n    for (const value of values) {\n        ${operation};\n    }\n    return result;\n}\n`,
            output: `function collect(values) {\n    const result = ${initializer};\n    for (const value of values) {\n        ${operation};\n    }\n\n    return result;\n}\n`,
            errors: [{ messageId: "expectedBlank" }],
        })),
        {
            code: "function total(values) {\n    let total = 0;\n    for (const value of values) {\n        total += value;\n    }\n    return total;\n}\n",
            output: "function total(values) {\n    let total = 0;\n    for (const value of values) {\n        total += value;\n    }\n\n    return total;\n}\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            code: "function factory() {\n    const first = load();\n    const unused = load();\n    const last = load();\n    return () => combine(first, last);\n}\n",
            output: "function factory() {\n    const first = load();\n    const unused = load();\n    const last = load();\n\n    return () => combine(first, last);\n}\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            code: "function factory() {\n    const unused = load();\n    const value = load();\n\n    return () => consume(value);\n}\n",
            output: "function factory() {\n    const unused = load();\n    const value = load();\n    return () => consume(value);\n}\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            code: "function factory() {\n    const value = load();\n\n    return () => consume(value);\n}\n",
            output: "function factory() {\n    const value = load();\n    return () => consume(value);\n}\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            code: "function reset(state) {\n    state.enabled = false;\n    state.options = undefined;\n    clear();\n    state.cache = new Map();\n    state.cache.clear();\n\n    return;\n}\n",
            output: "function reset(state) {\n    state.enabled = false;\n    state.options = undefined;\n    clear();\n    state.cache = new Map();\n    state.cache.clear();\n    return;\n}\n",
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
            code: "function preview(record, action) {\n    if (record.path !== undefined) action = { ...action, path: record.path };\n    if (record.limit !== undefined) action = { ...action, limit: record.limit };\n    return action;\n}\n",
            output: "function preview(record, action) {\n    if (record.path !== undefined) action = { ...action, path: record.path };\n    if (record.limit !== undefined) action = { ...action, limit: record.limit };\n\n    return action;\n}\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            code: "function size(lines) {\n    let bytes = 0;\n    for (const line of lines) {\n        bytes += Buffer.byteLength(line);\n    }\n    return bytes;\n}\n",
            output: "function size(lines) {\n    let bytes = 0;\n    for (const line of lines) {\n        bytes += Buffer.byteLength(line);\n    }\n\n    return bytes;\n}\n",
            errors: [{ messageId: "expectedBlank" }],
        },
        {
            code: 'function header(server) {\n    const prefix = loadPrefix();\n    const suffix = loadSuffix(prefix);\n    if (server !== undefined) return { label: "Status", body: server };\n    return { label: "Status", body: undefined };\n}\n',
            output: 'function header(server) {\n    const prefix = loadPrefix();\n    const suffix = loadSuffix(prefix);\n    if (server !== undefined) return { label: "Status", body: server };\n\n    return { label: "Status", body: undefined };\n}\n',
            errors: [{ messageId: "expectedBlank" }],
        },
    ],
});
