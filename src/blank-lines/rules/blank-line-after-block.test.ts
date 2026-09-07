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
        "function choose(item) {\n    if (primary(item)) {\n        return true;\n    }\n    if (secondary(item)) {\n        return false;\n    }\n\n    return fallback(item);\n}\n",
        "function restore(target, value) {\n    if (value === undefined) {\n        delete target.slot;\n        return;\n    }\n    target.slot = value;\n}\n",
        "function restore(target, other, value) {\n    if (value === undefined) {\n        delete target.slot;\n        return;\n    }\n\n    other.slot = value;\n}\n",
        "function restore(target, key, otherKey, value) {\n    if (value === undefined) {\n        delete target[key];\n        return;\n    }\n\n    target[otherKey] = value;\n}\n",
        "function collect(values) {\n    const result = [];\n    for (const result of values) {\n        result.push(1);\n    }\n\n    return result;\n}\n",
        "function collect(values) {\n    const result = [];\n    for (const value of values) {\n        schedule(() => result.push(value));\n    }\n\n    return result;\n}\n",
        "function configure(target, input) {\n    if (input.first) {\n        target.first = input.first;\n    }\n    if (input.second) {\n        target.second = input.second;\n    }\n}\n",
        "function build(input) {\n    let result = {};\n    if (input.first) {\n        result = { ...result, first: input.first };\n    }\n    if (input.second) {\n        result = { ...result, second: input.second };\n    }\n\n    return result;\n}\n",
        "function disable(state) {\n    if (state.active) {\n        restore(state.original);\n    }\n    return;\n}\n",
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
            code: "function account(input) {\n    let success = 0;\n    let failure = 0;\n    if (input.ready) {\n        success += 1;\n        return;\n    }\n\n    failure += 1;\n}\n",
            output: "function account(input) {\n    let success = 0;\n    let failure = 0;\n    if (input.ready) {\n        success += 1;\n        return;\n    }\n    failure += 1;\n}\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            code: "function match(item) {\n    if (!(item instanceof Item)) {\n        return false;\n    }\n\n    const lines = item.render(1);\n    return lines.length === 1;\n}\n",
            output: "function match(item) {\n    if (!(item instanceof Item)) {\n        return false;\n    }\n    const lines = item.render(1);\n    return lines.length === 1;\n}\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            code: "function collect(values) {\n    const result = [];\n    for (const value of values) {\n        result.push(value);\n    }\n\n    return result;\n}\n",
            output: "function collect(values) {\n    const result = [];\n    for (const value of values) {\n        result.push(value);\n    }\n    return result;\n}\n",
            errors: [{ messageId: "unexpectedBlank" }],
        },
        {
            code: "function total(values) {\n    let total = 0;\n    for (const value of values) {\n        total += value;\n    }\n\n    return total;\n}\n",
            output: "function total(values) {\n    let total = 0;\n    for (const value of values) {\n        total += value;\n    }\n    return total;\n}\n",
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
    ],
});
