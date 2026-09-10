import { RuleTester } from "../../../test/rule-tester.ts";
import controlFlowCuddling from "./control-flow-cuddling.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

const aliasInitializers = [
    "source",
    "(source)",
    "source as Target",
    "source!",
    "source satisfies Target",
    "<Target>source",
    "source<string>",
    "((source as Target)!) satisfies Target",
];

tester.run("blank-lines/control-flow-cuddling", controlFlowCuddling, {
    valid: [
        ...aliasInitializers.map(
            (initializer) =>
                `function configure(source) {\n    const target = ${initializer};\n    if (target) {\n        restore(target);\n    }\n}\n`,
        ),
        ...["load(source) as Target", "({ value: source }) satisfies Target", "[source]!"].map(
            (initializer) =>
                `function configure(source, enabled) {\n    const target = ${initializer};\n    if (!enabled) {\n        restore(target);\n    }\n}\n`,
        ),
        "function run(input) {\n    const size = measure(input);\n    if (size > limit) return;\n\n    consume(input);\n}\n",
        "function disable(state) {\n    state.enabled = false;\n    if (state.wrapper !== undefined) {\n        restore(state.wrapper);\n    }\n}\n",
        "function configure(target, input) {\n    if (input.first) {\n        target.first = input.first;\n    }\n\n    if (input.second) {\n        target.second = input.second;\n    }\n}\n",
        "function disable(state) {\n    state.enabled = false;\n\n    if (state.wrapper !== undefined) {\n        restore(state.wrapper);\n    }\n}\n",
        "function configure(source) {\n    const target = source;\n\n    if (!enabled) {\n        restore(target);\n    }\n}\n",
        {
            options: [{ compactRelatedControlFlow: false }],
            code: "function select(value) {\n    if (value === 1) {\n        return 1;\n    }\n\n    if (value === 2) {\n        return 2;\n    }\n}\n",
        },
        "const unrelated = read();\nconst ready = check();\nif (ready) {\n    run();\n}\n",
        "let ready;\nlet unrelated = read();\nready = check();\nif (ready) {\n    run();\n}\n",
        "const ready = check();\nif (ready) {\n    run();\n}\n",
        "const start = getStart();\nfor (let i = start; i < 10; i++) {\n    visit(i);\n}\n",
        "const render = (item) => format(item);\nfor (const item of items) {\n    print(render(item));\n}\n",
        "const rows = [];\nfor (const row of source) {\n    rows.push(row);\n}\n",
        "const result = load();\nif (enabled) {\n    consume(result);\n}\n",
        "const value = read();\n\nif (other) {\n    run();\n}\n",
        // Consecutive compact single-line loops are one traversal unit.
        'function kinds(content, push) {\n    for (let index = 0; index < content.deletions; index += 1) push("delete");\n    for (let index = 0; index < content.additions; index += 1) push("insert");\n}\n',
        "function counts(rows) {\n    while (rows[start]) rows[start].used = true;\n    while (rows[end]) rows[end].used = false;\n}\n",
    ],
    invalid: [
        {
            code: "function clear(editor) {\n    const redraw = editor.visible;\n    clearUi();\n    if (redraw) {\n        editor.render();\n    }\n}\n",
            output: "function clear(editor) {\n    const redraw = editor.visible;\n    clearUi();\n\n    if (redraw) {\n        editor.render();\n    }\n}\n",
            errors: [{ messageId: "unrelated" }],
        },
        {
            // A guard that reads the setup binding stays with it: the blank
            // belongs after the completed step above, not before the guard.
            code: "function run(input) {\n    release(input);\n    const size = measure(input);\n\n    if (size > limit) return;\n    consume(input);\n}\n",
            output: "function run(input) {\n    release(input);\n    const size = measure(input);\n    if (size > limit) return;\n    consume(input);\n}\n",
            errors: [{ messageId: "related" }],
        },
        {
            code: "function clear(slots, key) {\n    delete slots[key];\n    if (slots.first === undefined && slots.second === undefined) {\n        cleanup(slots);\n    }\n}\n",
            output: "function clear(slots, key) {\n    delete slots[key];\n\n    if (slots.first === undefined && slots.second === undefined) {\n        cleanup(slots);\n    }\n}\n",
            errors: [{ messageId: "unrelated" }],
        },
        ...aliasInitializers.map((initializer) => ({
            code: `function configure(source, enabled) {\n    const target = ${initializer};\n    if (!enabled) {\n        restore(target);\n    }\n}\n`,
            output: `function configure(source, enabled) {\n    const target = ${initializer};\n\n    if (!enabled) {\n        restore(target);\n    }\n}\n`,
            errors: [{ messageId: "unrelated" }],
        })),
        {
            code: "function configure(source, enabled) {\n    const target = enabled\n        ? { value: source }\n        : { value: source, disabled: true };\n    if (accept(target)) {\n        apply(target);\n    }\n}\n",
            output: "function configure(source, enabled) {\n    const target = enabled\n        ? { value: source }\n        : { value: source, disabled: true };\n\n    if (accept(target)) {\n        apply(target);\n    }\n}\n",
            errors: [{ messageId: "unrelated" }],
        },
        {
            code: "function disable(state) {\n    if (state.active) {\n        state.enabled = false;\n        if (state.wrapper !== undefined) {\n            restore(state.wrapper);\n        }\n    }\n}\n",
            output: "function disable(state) {\n    if (state.active) {\n        state.enabled = false;\n\n        if (state.wrapper !== undefined) {\n            restore(state.wrapper);\n        }\n    }\n}\n",
            errors: [{ messageId: "unrelated" }],
        },
        {
            code: "function install(target, first, second) {\n    if (first !== undefined) {\n        target.first = first;\n    }\n    if (second !== undefined) {\n        target.second = second;\n    }\n}\n",
            output: "function install(target, first, second) {\n    if (first !== undefined) {\n        target.first = first;\n    }\n\n    if (second !== undefined) {\n        target.second = second;\n    }\n}\n",
            errors: [{ messageId: "unrelated" }],
        },
        {
            languageOptions: { globals: { arguments: "readonly" } },
            code: "if (arguments[0]) {\n    acceptFirst();\n}\nif (arguments[1]) {\n    acceptSecond();\n}\n",
            output: "if (arguments[0]) {\n    acceptFirst();\n}\n\nif (arguments[1]) {\n    acceptSecond();\n}\n",
            errors: [{ messageId: "unrelated" }],
        },
        {
            languageOptions: { globals: { sentinel: "writable" } },
            code: "function configure(first, second) {\n    if (first !== sentinel) {\n        acceptFirst();\n    }\n    if (second !== sentinel) {\n        acceptSecond();\n    }\n}\n",
            output: "function configure(first, second) {\n    if (first !== sentinel) {\n        acceptFirst();\n    }\n\n    if (second !== sentinel) {\n        acceptSecond();\n    }\n}\n",
            errors: [{ messageId: "unrelated" }],
        },
        {
            code: "function visit(calls, index) {\n    const call = calls[index];\n    index += 1;\n    if (call.ready) {\n        run(call);\n    }\n}\n",
            output: "function visit(calls, index) {\n    const call = calls[index];\n    index += 1;\n\n    if (call.ready) {\n        run(call);\n    }\n}\n",
            errors: [{ messageId: "unrelated" }],
        },
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
        {
            code: "function inspect() {\n    if (arguments[0]) {\n        acceptFirst();\n    }\n    if (arguments[1]) {\n        acceptSecond();\n    }\n}\n",
            output: "function inspect() {\n    if (arguments[0]) {\n        acceptFirst();\n    }\n\n    if (arguments[1]) {\n        acceptSecond();\n    }\n}\n",
            errors: [{ messageId: "unrelated" }],
        },
        {
            code: "function inspect() {\n    return () => {\n        if (arguments[0]) {\n            acceptFirst();\n        }\n        if (arguments[1]) {\n            acceptSecond();\n        }\n    };\n}\n",
            output: "function inspect() {\n    return () => {\n        if (arguments[0]) {\n            acceptFirst();\n        }\n\n        if (arguments[1]) {\n            acceptSecond();\n        }\n    };\n}\n",
            errors: [{ messageId: "unrelated" }],
        },
        {
            code: "function configure(target, first, second, undefined) {\n    if (first !== undefined) {\n        target.first = first;\n    }\n    if (second !== undefined) {\n        target.second = second;\n    }\n}\n",
            output: "function configure(target, first, second, undefined) {\n    if (first !== undefined) {\n        target.first = first;\n    }\n\n    if (second !== undefined) {\n        target.second = second;\n    }\n}\n",
            errors: [{ messageId: "unrelated" }],
        },
        {
            code: "function configure(target, input) {\n    if (input.first) {\n        target.first = input.first;\n    }\n    if (input.second) {\n        target.second = input.second;\n    }\n}\n",
            output: "function configure(target, input) {\n    if (input.first) {\n        target.first = input.first;\n    }\n\n    if (input.second) {\n        target.second = input.second;\n    }\n}\n",
            errors: [{ messageId: "unrelated" }],
        },
        {
            languageOptions: { sourceType: "script" },
            code: "declare const sentinel: unknown;\nfunction configure(target, first, second) {\n    if (first !== sentinel) {\n        target.first = first;\n    }\n    if (second !== sentinel) {\n        target.second = second;\n    }\n}\n",
            output: "declare const sentinel: unknown;\nfunction configure(target, first, second) {\n    if (first !== sentinel) {\n        target.first = first;\n    }\n\n    if (second !== sentinel) {\n        target.second = second;\n    }\n}\n",
            errors: [{ messageId: "unrelated" }],
        },
        {
            languageOptions: { sourceType: "script" },
            code: "function sentinel() {}\nfunction configure(target, first, second) {\n    if (first !== sentinel) {\n        target.first = first;\n    }\n    if (second !== sentinel) {\n        target.second = second;\n    }\n}\n",
            output: "function sentinel() {}\nfunction configure(target, first, second) {\n    if (first !== sentinel) {\n        target.first = first;\n    }\n\n    if (second !== sentinel) {\n        target.second = second;\n    }\n}\n",
            errors: [{ messageId: "unrelated" }],
        },
        {
            languageOptions: { globals: { sentinel: "writable" } },
            code: "function update(value) {\n    sentinel = value;\n}\nfunction configure(first, second) {\n    if (first !== sentinel) {\n        acceptFirst();\n    }\n    if (second !== sentinel) {\n        acceptSecond();\n    }\n}\n",
            output: "function update(value) {\n    sentinel = value;\n}\nfunction configure(first, second) {\n    if (first !== sentinel) {\n        acceptFirst();\n    }\n\n    if (second !== sentinel) {\n        acceptSecond();\n    }\n}\n",
            errors: [{ messageId: "unrelated" }],
        },
        {
            code: "function renderAll(items) {\n    const render = (item) => {\n        const line = format(item);\n        return prefix + line;\n    };\n    for (const item of items) {\n        print(render(item));\n    }\n}\n",
            output: "function renderAll(items) {\n    const render = (item) => {\n        const line = format(item);\n        return prefix + line;\n    };\n\n    for (const item of items) {\n        print(render(item));\n    }\n}\n",
            errors: [{ messageId: "callbackPhase" }],
        },
        {
            // Two multiline scans over the same state are separate passes
            // (forward trim, backward trim), unlike the single-line pair above.
            code: 'function trim(rows) {\n    while (rows[start] === "") {\n        start += 1;\n    }\n    while (end > start && rows[end - 1] === "") {\n        end -= 1;\n    }\n}\n',
            output: 'function trim(rows) {\n    while (rows[start] === "") {\n        start += 1;\n    }\n\n    while (end > start && rows[end - 1] === "") {\n        end -= 1;\n    }\n}\n',
            errors: [{ messageId: "unrelated" }],
        },
        {
            code: 'function split(content, push) {\n    for (let offset = 0; offset < content.deletions; offset += 1) {\n        push("del", offset);\n    }\n    for (let offset = 0; offset < content.additions; offset += 1) {\n        push("add", offset);\n    }\n}\n',
            output: 'function split(content, push) {\n    for (let offset = 0; offset < content.deletions; offset += 1) {\n        push("del", offset);\n    }\n\n    for (let offset = 0; offset < content.additions; offset += 1) {\n        push("add", offset);\n    }\n}\n',
            errors: [{ messageId: "unrelated" }],
        },
    ],
});
