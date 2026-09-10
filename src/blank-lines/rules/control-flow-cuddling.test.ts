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
        {
            name: "keeps an expression-bodied callback with its consuming loop",
            code: `const render = (item) => format(item);
for (const item of items) {
    print(render(item));
}
`,
        },
        {
            name: "keeps an empty collection with the loop that fills it",
            code: `const rows = [];
for (const row of source) {
    rows.push(row);
}
`,
        },
        "const result = load();\nif (enabled) {\n    consume(result);\n}\n",
        "const value = read();\n\nif (other) {\n    run();\n}\n",
        // Consecutive compact single-line loops are one traversal unit.
        {
            name: "allows adjacent single-line for loops",
            code: `function kinds(content, push) {
    for (let index = 0; index < content.deletions; index += 1) push("delete");
    for (let index = 0; index < content.additions; index += 1) push("insert");
}
`,
        },
        {
            name: "allows adjacent single-line while loops",
            code: `function counts(rows) {
    while (rows[start]) rows[start].used = true;
    while (rows[end]) rows[end].used = false;
}
`,
        },
    ],
    invalid: [
        {
            name: "separates a guard from an intervening call",
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
            errors: [{ messageId: "unrelated" }],
        },
        {
            name: "keeps a guard with its immediate setup after a call",
            // A guard that reads the setup binding stays with it: the blank
            // belongs after the completed step above, not before the guard.
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
            name: "separates braced guards reading arguments",
            code: `function inspect() {
    if (arguments[0]) {
        acceptFirst();
    }
    if (arguments[1]) {
        acceptSecond();
    }
}
`,
            output: `function inspect() {
    if (arguments[0]) {
        acceptFirst();
    }

    if (arguments[1]) {
        acceptSecond();
    }
}
`,
            errors: [{ messageId: "unrelated" }],
        },
        {
            name: "separates braced guards reading captured arguments",
            code: `function inspect() {
    return () => {
        if (arguments[0]) {
            acceptFirst();
        }
        if (arguments[1]) {
            acceptSecond();
        }
    };
}
`,
            output: `function inspect() {
    return () => {
        if (arguments[0]) {
            acceptFirst();
        }

        if (arguments[1]) {
            acceptSecond();
        }
    };
}
`,
            errors: [{ messageId: "unrelated" }],
        },
        {
            name: "separates braced updates comparing a shadowed undefined",
            code: `function configure(target, first, second, undefined) {
    if (first !== undefined) {
        target.first = first;
    }
    if (second !== undefined) {
        target.second = second;
    }
}
`,
            output: `function configure(target, first, second, undefined) {
    if (first !== undefined) {
        target.first = first;
    }

    if (second !== undefined) {
        target.second = second;
    }
}
`,
            errors: [{ messageId: "unrelated" }],
        },
        {
            name: "separates braced updates reading the same input",
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
            errors: [{ messageId: "unrelated" }],
        },
        {
            name: "separates braced guards comparing a declared sentinel",
            languageOptions: { sourceType: "script" },
            code: `declare const sentinel: unknown;
function configure(target, first, second) {
    if (first !== sentinel) {
        target.first = first;
    }
    if (second !== sentinel) {
        target.second = second;
    }
}
`,
            output: `declare const sentinel: unknown;
function configure(target, first, second) {
    if (first !== sentinel) {
        target.first = first;
    }

    if (second !== sentinel) {
        target.second = second;
    }
}
`,
            errors: [{ messageId: "unrelated" }],
        },
        {
            name: "separates braced guards comparing a function sentinel",
            languageOptions: { sourceType: "script" },
            code: `function sentinel() {}
function configure(target, first, second) {
    if (first !== sentinel) {
        target.first = first;
    }
    if (second !== sentinel) {
        target.second = second;
    }
}
`,
            output: `function sentinel() {}
function configure(target, first, second) {
    if (first !== sentinel) {
        target.first = first;
    }

    if (second !== sentinel) {
        target.second = second;
    }
}
`,
            errors: [{ messageId: "unrelated" }],
        },
        {
            name: "separates braced guards comparing a reassigned sentinel",
            languageOptions: { globals: { sentinel: "writable" } },
            code: `function update(value) {
    sentinel = value;
}
function configure(first, second) {
    if (first !== sentinel) {
        acceptFirst();
    }
    if (second !== sentinel) {
        acceptSecond();
    }
}
`,
            output: `function update(value) {
    sentinel = value;
}
function configure(first, second) {
    if (first !== sentinel) {
        acceptFirst();
    }

    if (second !== sentinel) {
        acceptSecond();
    }
}
`,
            errors: [{ messageId: "unrelated" }],
        },
        {
            name: "separates a multiline callback from its consuming loop",
            code: `function renderAll(items) {
    const render = (item) => {
        const line = format(item);
        return prefix + line;
    };
    for (const item of items) {
        print(render(item));
    }
}
`,
            output: `function renderAll(items) {
    const render = (item) => {
        const line = format(item);
        return prefix + line;
    };

    for (const item of items) {
        print(render(item));
    }
}
`,
            errors: [{ messageId: "callbackPhase" }],
        },
        {
            name: "separates multiline while scans over the same collection",
            // Two multiline scans over the same state are separate passes
            // (forward trim, backward trim), unlike the single-line pair above.
            code: `function trim(rows) {
    while (rows[start] === "") {
        start += 1;
    }
    while (end > start && rows[end - 1] === "") {
        end -= 1;
    }
}
`,
            output: `function trim(rows) {
    while (rows[start] === "") {
        start += 1;
    }

    while (end > start && rows[end - 1] === "") {
        end -= 1;
    }
}
`,
            errors: [{ messageId: "unrelated" }],
        },
        {
            name: "separates multiline for passes over the same input",
            code: `function split(content, push) {
    for (let offset = 0; offset < content.deletions; offset += 1) {
        push("del", offset);
    }
    for (let offset = 0; offset < content.additions; offset += 1) {
        push("add", offset);
    }
}
`,
            output: `function split(content, push) {
    for (let offset = 0; offset < content.deletions; offset += 1) {
        push("del", offset);
    }

    for (let offset = 0; offset < content.additions; offset += 1) {
        push("add", offset);
    }
}
`,
            errors: [{ messageId: "unrelated" }],
        },
    ],
});
