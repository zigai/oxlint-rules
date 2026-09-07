import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { recommendedConfig } from "../src/config/blank-lines.ts";

const fixtures = [
    {
        name: "destructured-setup.ts",
        input: "function decode(source, remaining) {\n    prepare();\n\n    const { values: rows, length: rowCount } = collection(source);\n\n    remaining -= rowCount;\n\n    const lines = [];\n    for (let row = 0; row < rowCount; row++) {\n        lines.push(rows[row]);\n    }\n\n    finish(lines, remaining);\n}\n",
        output: "function decode(source, remaining) {\n    prepare();\n\n    const { values: rows, length: rowCount } = collection(source);\n    remaining -= rowCount;\n    const lines = [];\n    for (let row = 0; row < rowCount; row++) {\n        lines.push(rows[row]);\n    }\n\n    finish(lines, remaining);\n}\n",
    },
    {
        name: "destructured-setup.test.ts",
        input: "function decode(source, remaining) {\n    prepare();\n\n    const { values: rows, length: rowCount } = collection(source);\n\n    remaining -= rowCount;\n\n    const lines = [];\n    for (let row = 0; row < rowCount; row++) {\n        lines.push(rows[row]);\n    }\n\n    finish(lines, remaining);\n}\n",
    },
    {
        name: "array-setup.ts",
        input: "function decode(source, remaining) {\n    prepare();\n\n    const [rows, rowCount] = collection(source);\n\n    remaining -= rowCount;\n\n    const lines = [];\n    for (let row = 0; row < rowCount; row++) {\n        lines.push(rows[row]);\n    }\n\n    finish(lines, remaining);\n}\n",
        output: "function decode(source, remaining) {\n    prepare();\n\n    const [rows, rowCount] = collection(source);\n    remaining -= rowCount;\n    const lines = [];\n    for (let row = 0; row < rowCount; row++) {\n        lines.push(rows[row]);\n    }\n\n    finish(lines, remaining);\n}\n",
    },
    {
        name: "unrelated-setup.ts",
        input: "function decode(source, remaining) {\n    prepare();\n\n    const { values: rows, length: rowCount } = collection(source);\n\n    remaining -= source.length;\n\n    const lines = [];\n    for (let row = 0; row < rowCount; row++) {\n        lines.push(rows[row]);\n    }\n\n    finish(lines, remaining);\n}\n",
    },
    {
        name: "unconsumed-output.ts",
        input: "function decode(source, remaining) {\n    prepare();\n\n    const { values: rows, length: rowCount } = collection(source);\n\n    remaining -= rowCount;\n\n    const lines = [];\n    for (let row = 0; row < rowCount; row++) {\n        lines.push(source[row]);\n    }\n\n    finish(lines, rows, remaining);\n}\n",
    },
    {
        name: "try-finally-target.ts",
        input: "function decode(state, value) {\n    state.active.add(value);\n\n    try {\n        return decodeValue(value);\n    } finally {\n        state.active.delete(value);\n    }\n}\n",
        output: "function decode(state, value) {\n    state.active.add(value);\n    try {\n        return decodeValue(value);\n    } finally {\n        state.active.delete(value);\n    }\n}\n",
    },
    {
        name: "try-finally-target.test.ts",
        input: "function decode(state, value) {\n    state.active.add(value);\n\n    try {\n        return decodeValue(value);\n    } finally {\n        state.active.delete(value);\n    }\n}\n",
        output: "function decode(state, value) {\n    state.active.add(value);\n    try {\n        return decodeValue(value);\n    } finally {\n        state.active.delete(value);\n    }\n}\n",
    },
    {
        name: "try-finally-other-target.ts",
        input: "function decode(state, value) {\n    state.active.add(value);\n\n    try {\n        return decodeValue(value);\n    } finally {\n        state.other.delete(value);\n    }\n}\n",
    },
    {
        name: "try-finally-other-argument.ts",
        input: "function decode(state, value) {\n    state.active.add(value);\n\n    try {\n        return decodeValue(value);\n    } finally {\n        state.active.delete(other);\n    }\n}\n",
    },
    {
        name: "try-finally-dynamic-argument.ts",
        input: "function decode(state, value) {\n    state.active.add(readValue());\n\n    try {\n        return decodeValue(readValue());\n    } finally {\n        state.active.delete(readValue());\n    }\n}\n",
    },
    {
        name: "try-finally-shadowed.ts",
        input: "function decode(state, value) {\n    state.active.add(value);\n\n    try {\n        return decodeValue(value);\n    } finally {\n        const value = read();\n        state.active.delete(value);\n    }\n}\n",
    },
    {
        name: "long-return-boundary.ts",
        input: "function format(output) {\n    const formatted = normalizeCode(output);\n    if (formatted.trim().length === 0) return undefined;\n    remember(cacheKey, formatted);\n\n    return formatted;\n}\n",
    },
    {
        name: "tiny-return-boundary.ts",
        input: "function format(formatted) {\n    remember(cacheKey, formatted);\n\n    return formatted;\n}\n",
        output: "function format(formatted) {\n    remember(cacheKey, formatted);\n    return formatted;\n}\n",
    },
    {
        name: "declared-method-object.ts",
        input: "function create() {\n    const state = {\n        read() {\n            return source;\n        },\n    };\n\n    return state;\n}\n",
    },
    {
        name: "common-predicate.ts",
        input: "function select(check, first, second) {\n    if (check(first)) {\n        return 1;\n    }\n\n    if (check(second)) {\n        return 2;\n    }\n}\n",
    },
    {
        name: "commented-guards.ts",
        input: "function select(value) {\n    if (value === 1) {\n        return 1;\n    }\n\n    // Handle the second case.\n    if (value === 2) {\n        return 2;\n    }\n}\n",
    },
    {
        name: "guard-phases.test.ts",
        input: "function select(value) {\n    if (value === 1) {\n        return 1;\n    }\n\n    if (value === 2) {\n        return 2;\n    }\n}\n",
    },
    {
        name: "catch-rethrow.test.ts",
        input: "async function run() {\n    try {\n        await work();\n    } catch (cause) {\n        await record(cause);\n\n        throw cause;\n    }\n}\n",
        output: "async function run() {\n    try {\n        await work();\n    } catch (cause) {\n        await record(cause);\n        throw cause;\n    }\n}\n",
    },
    {
        name: "catch-long.test.ts",
        input: "async function run() {\n    try {\n        await work();\n    } catch (cause) {\n        await capture(cause);\n        await flush();\n        cleanup();\n\n        throw cause;\n    }\n}\n",
    },
    {
        name: "void-operation.ts",
        input: "function run(state) {\n    state.timer = undefined;\n    void processNext();\n}\n",
    },
    {
        name: "delete-operation.ts",
        input: "function clear(state) {\n    release(state);\n    delete state.cache;\n    finish(state);\n}\n",
    },
    {
        name: "wrapped-use.ts",
        input: "function render(state) {\n    const rows =\n        state.cachedRows ?? buildRows();\n\n    state.cachedRows = rows;\n    return renderRows(rows);\n}\n",
        output: "function render(state) {\n    const rows =\n        state.cachedRows ?? buildRows();\n    state.cachedRows = rows;\n    return renderRows(rows);\n}\n",
    },
    {
        name: "wrapped-return.ts",
        input: 'function summarize(record) {\n    const values = getArray(record)\n        ?.map((value) => stringParser.parse(value))\n        .filter(isDefined);\n\n    return values === undefined ? undefined : values.join(" · ");\n}\n',
        output: 'function summarize(record) {\n    const values = getArray(record)\n        ?.map((value) => stringParser.parse(value))\n        .filter(isDefined);\n    return values === undefined ? undefined : values.join(" · ");\n}\n',
    },
    {
        name: "wrapped-unrelated.ts",
        input: "function run(state) {\n    const rows =\n        state.cachedRows ?? buildRows();\n\n    log(state);\n    flush();\n    return rows;\n}\n",
        output: "function run(state) {\n    const rows =\n        state.cachedRows ?? buildRows();\n\n    log(state);\n    flush();\n\n    return rows;\n}\n",
    },
    {
        name: "wrapped-callback.ts",
        input: "const rows =\n    source.rows ?? buildRows();\n\nregister(rows, () => rows.clear());\n",
    },
    {
        name: "wrapped-phases.test.ts",
        input: "function run(state) {\n    const rows =\n        state.cachedRows ?? buildRows();\n\n    expect(rows).toEqual([]);\n}\n",
    },
    {
        name: "related-guards.ts",
        input: 'function select(value) {\n    if (value === 1) {\n        return "one";\n    }\n\n    if (value === 2) {\n        return "two";\n    }\n\n    return "other";\n}\n',
        output: 'function select(value) {\n    if (value === 1) {\n        return "one";\n    }\n    if (value === 2) {\n        return "two";\n    }\n\n    return "other";\n}\n',
    },
    {
        name: "unrelated-guards.ts",
        input: 'function select(first, second) {\n    if (first === 1) {\n        return "one";\n    }\n\n    if (second === 2) {\n        return "two";\n    }\n\n    return "other";\n}\n',
    },
    {
        name: "large-guards.ts",
        input: 'function select(value) {\n    if (value === 1) {\n        log(value);\n        return "one";\n    }\n\n    if (value === 2) {\n        log(value);\n        return "two";\n    }\n\n    return "other";\n}\n',
    },
    {
        name: "related-loops.ts",
        input: "function trim(rows) {\n    let start = 0;\n    let end = rows.length;\n\n    while (rows[start]?.collapsed) start++;\n\n    while (end > start && rows[end - 1]?.collapsed) end--;\n\n    return rows.slice(start, end);\n}\n",
        output: "function trim(rows) {\n    let start = 0;\n    let end = rows.length;\n\n    while (rows[start]?.collapsed) start++;\n    while (end > start && rows[end - 1]?.collapsed) end--;\n\n    return rows.slice(start, end);\n}\n",
    },
    {
        name: "unrelated-loops.ts",
        input: "function clear(first, second) {\n    while (first.length) first.pop();\n\n    while (second.length) second.pop();\n}\n",
    },
    {
        name: "switch-cases.ts",
        input: "function select(value) {\n    switch (value) {\n        case 1: {\n            const item = read();\n            return process(item);\n        }\n\n        case 2:\n            return fallback();\n\n        default:\n            return undefined;\n    }\n}\n",
        output: "function select(value) {\n    switch (value) {\n        case 1: {\n            const item = read();\n            return process(item);\n        }\n        case 2:\n            return fallback();\n        default:\n            return undefined;\n    }\n}\n",
    },
    {
        name: "scoped-key.ts",
        input: "function count(state, key) {\n    state[key]++;\n\n    if (state[key] > limit) reject();\n}\n",
        output: "function count(state, key) {\n    state[key]++;\n    if (state[key] > limit) reject();\n}\n",
    },
    {
        name: "this-property.ts",
        input: "class Counter {\n    update() {\n        this.count++;\n\n        if (this.count > limit) reject();\n    }\n}\n",
        output: "class Counter {\n    update() {\n        this.count++;\n        if (this.count > limit) reject();\n    }\n}\n",
    },
    {
        name: "dynamic-key.ts",
        input: "function count(state) {\n    state[key()]++;\n\n    if (state[key()] > limit) reject();\n}\n",
    },
    {
        name: "different-receivers.ts",
        input: "function update(first, second) {\n    if (enabled) {\n        first.count++;\n    }\n\n    if (enabled) {\n        second.count++;\n    }\n}\n",
    },
    {
        name: "deferred-body-use.ts",
        input: "function run() {\n    const results = [];\n\n    while (ready) {\n        schedule(() => results.push(value));\n    }\n\n    return results;\n}\n",
    },
    {
        name: "callback-direct-argument.ts",
        input: "const state = create();\nregister(state, () => state.clear());\n",
        output: "const state = create();\n\nregister(state, () => state.clear());\n",
    },
    {
        name: "retained-method-state.ts",
        input: "function create() {\n    const state = new Map();\n    return {\n        state,\n        read(key) {\n            return state.get(key);\n        },\n    };\n}\n",
        output: "function create() {\n    const state = new Map();\n\n    return {\n        state,\n        read(key) {\n            return state.get(key);\n        },\n    };\n}\n",
    },
    {
        name: "callback-inside-loop.ts",
        input: "function collect(items) {\n    const results = [];\n\n    for (const item of items) {\n        results.push(item);\n        schedule(() => consume(item));\n    }\n\n    return results;\n}\n",
        output: "function collect(items) {\n    const results = [];\n    for (const item of items) {\n        results.push(item);\n        schedule(() => consume(item));\n    }\n\n    return results;\n}\n",
    },
    {
        name: "operation-exit.ts",
        input: "function run() {\n    if (skip) {\n        flush();\n\n        return;\n    }\n\n    finish();\n}\n",
        output: "function run() {\n    if (skip) {\n        flush();\n        return;\n    }\n\n    finish();\n}\n",
    },
    {
        name: "timing.ts",
        input: "function measure(operation) {\n    const started = now();\n\n    operation();\n\n    return now() - started;\n}\n",
        output: "function measure(operation) {\n    const started = now();\n    operation();\n    return now() - started;\n}\n",
    },
    {
        name: "async-timing.ts",
        input: "async function measure(operation) {\n    const started = now();\n\n    await operation();\n\n    return now() - started;\n}\n",
        output: "async function measure(operation) {\n    const started = now();\n    await operation();\n    return now() - started;\n}\n",
    },
    {
        name: "related-pair.ts",
        input: "function compare() {\n    const before = tokenize(oldText);\n    const after = tokenize(newText);\n\n    if (before.length > limit || after.length > limit) {\n        return false;\n    }\n\n    return compareTokens(before, after);\n}\n",
        output: "function compare() {\n    const before = tokenize(oldText);\n    const after = tokenize(newText);\n    if (before.length > limit || after.length > limit) {\n        return false;\n    }\n\n    return compareTokens(before, after);\n}\n",
    },
    {
        name: "property-check.ts",
        input: "function count(state, value) {\n    state.textCharacters += value.length;\n\n    if (state.textCharacters > state.limit) reject();\n}\n",
        output: "function count(state, value) {\n    state.textCharacters += value.length;\n    if (state.textCharacters > state.limit) reject();\n}\n",
    },
    {
        name: "computed-property.ts",
        input: 'function count(state) {\n    state["count"]++;\n\n    if (state.count > limit) reject();\n}\n',
        output: 'function count(state) {\n    state["count"]++;\n    if (state.count > limit) reject();\n}\n',
    },
    {
        name: "unrelated-property.ts",
        input: "function count(state) {\n    state.count++;\n\n    if (state.other > limit) reject();\n}\n",
    },
    {
        name: "try-initialization.ts",
        input: "async function read(path) {\n    let info;\n\n    try {\n        info = await stat(path);\n    } catch (cause) {\n        throw cause;\n    }\n\n    return info;\n}\n",
        output: "async function read(path) {\n    let info;\n    try {\n        info = await stat(path);\n    } catch (cause) {\n        throw cause;\n    }\n\n    return info;\n}\n",
    },
    {
        name: "discard.ts",
        input: "function omit(record) {\n    const { metadata: discarded, ...settings } = record;\n\n    return settings;\n}\n",
        output: "function omit(record) {\n    const { metadata: discarded, ...settings } = record;\n    return settings;\n}\n",
    },
    {
        name: "conditional-updates.ts",
        input: "function normalize(source) {\n    const result = capture(source);\n    if (result.min !== undefined) {\n        result.min = Math.trunc(result.min);\n    }\n\n    if (result.max !== undefined)\n        result.max = Math.trunc(result.max);\n\n    return result;\n}\n",
        output: "function normalize(source) {\n    const result = capture(source);\n    if (result.min !== undefined) {\n        result.min = Math.trunc(result.min);\n    }\n    if (result.max !== undefined)\n        result.max = Math.trunc(result.max);\n    return result;\n}\n",
    },
    {
        name: "object-updates.ts",
        input: "function build(source) {\n    let result = {};\n\n    if (source.title) {\n        result = { ...result, title: source.title };\n    }\n\n    result = { ...result, enabled: true };\n\n    const preview = source.preview;\n\n    if (preview) {\n        result = { ...result, preview };\n    }\n\n    return result;\n}\n",
        output: "function build(source) {\n    let result = {};\n    if (source.title) {\n        result = { ...result, title: source.title };\n    }\n    result = { ...result, enabled: true };\n    const preview = source.preview;\n    if (preview) {\n        result = { ...result, preview };\n    }\n    return result;\n}\n",
    },
    {
        name: "callback-boundary.ts",
        input: "const pending = new Set();\nonChange(() => {\n    pending.clear();\n});\n",
        output: "const pending = new Set();\n\nonChange(() => {\n    pending.clear();\n});\n",
    },
    {
        name: "returned-methods.ts",
        input: "function create() {\n    let cached;\n    return {\n        read() {\n            return cached;\n        },\n    };\n}\n",
        output: "function create() {\n    let cached;\n\n    return {\n        read() {\n            return cached;\n        },\n    };\n}\n",
    },
    {
        name: "phases.test.ts",
        input: 'it("preserves phases", () => {\n    const initial = setup();\n\n    const result = run(initial);\n\n    expect(result).toEqual(initial);\n});\n\nit("preserves another test", () => {\n    setup();\n\n    expect(state).toBe(true);\n});\n',
    },
    {
        name: "short-helper.test.ts",
        input: "function helper() {\n    const started = now();\n\n    operation();\n\n    return now() - started;\n}\n",
    },
    {
        name: "initialization.ts",
        input: "function tokenize(text) {\n    const tokens = [];\n\n    pattern.lastIndex = 0;\n\n    for (const match of text.matchAll(pattern)) {\n        tokens.push(match);\n    }\n\n    return tokens;\n}\n",
        output: "function tokenize(text) {\n    const tokens = [];\n    pattern.lastIndex = 0;\n\n    for (const match of text.matchAll(pattern)) {\n        tokens.push(match);\n    }\n\n    return tokens;\n}\n",
    },
    {
        name: "multiline-declarations.ts",
        input: "const first = {\n    mode: 'static',\n};\n\nconst second = {\n    enabled: true,\n};\n",
    },
    {
        name: "overlapping-block-boundary.ts",
        input: "class Example {\n    method() {\n        return 1;\n    }\n\n\n\n}\n",
        output: "class Example {\n    method() {\n        return 1;\n    }\n}\n",
    },
    {
        name: "shadowed-callback.ts",
        input: "const value = read();\n\nif (items.some(value => value.ready)) {\n    work();\n}\n",
    },
    {
        name: "multiline-conditional-updates.ts",
        input: "function configure(env) {\n    if (shouldLog) {\n        env.LOG = '1';\n        env.DEBUG = '1';\n    }\n\n    if (hasJob) {\n        env.JOB = 'run';\n    }\n}\n",
    },
    {
        name: "multiline-class-field.ts",
        input: "class Config {\n    defaultProps = {\n        a: 1,\n        b: 2,\n    };\n\n    canvas: CanvasSurface;\n}\n",
    },
];

describe("semantic statement spacing", () => {
    it("fixes logical groups and preserves boundaries through the full Oxlint preset and formatter", () => {
        const directory = mkdtempSync(join(tmpdir(), "oxlint-semantic-spacing-"));
        const configPath = join(directory, "oxlint.json");
        const cli = join(process.cwd(), "node_modules/.bin/oxlint");
        const formatter = join(process.cwd(), "node_modules/.bin/oxfmt");
        writeFileSync(
            configPath,
            JSON.stringify({
                ...recommendedConfig,
                categories: { correctness: "off" },
                jsPlugins: [
                    {
                        name: "blank-lines",
                        specifier: join(process.cwd(), "dist/blank-lines/index.js"),
                    },
                ],
            }),
        );
        try {
            const paths = fixtures.map((fixture) => {
                const path = join(directory, fixture.name);
                writeFileSync(path, fixture.input);
                return path;
            });
            const initial = spawnSync(cli, ["-c", configPath, "--format", "json", ...paths], {
                encoding: "utf8",
            });
            expect(initial.status).toBe(0);
            expect(initial.stdout).toContain('"severity": "warning"');
            expect(initial.stdout).toContain("blank-lines");
            const fixed = spawnSync(cli, ["-c", configPath, "--fix", "--deny-warnings", ...paths], {
                encoding: "utf8",
            });
            expect(fixed.status, fixed.stdout + fixed.stderr).toBe(0);
            for (const [index, fixture] of fixtures.entries()) {
                const path = paths[index];
                if (path === undefined) throw new Error("Missing fixture path");
                expect(readFileSync(path, "utf8"), fixture.name).toBe(
                    fixture.output ?? fixture.input,
                );
            }
            for (let pass = 0; pass < 2; pass++) {
                const formatted = spawnSync(formatter, paths, { encoding: "utf8" });
                expect(formatted.status, formatted.stdout + formatted.stderr).toBe(0);
                const check = spawnSync(cli, ["-c", configPath, "--deny-warnings", ...paths], {
                    encoding: "utf8",
                });
                expect(check.status, check.stdout + check.stderr).toBe(0);
                const before = paths.map((path) => readFileSync(path, "utf8"));
                const fixed = spawnSync(cli, ["-c", configPath, "--fix", ...paths], {
                    encoding: "utf8",
                });
                expect(fixed.status, fixed.stdout + fixed.stderr).toBe(0);
                expect(paths.map((path) => readFileSync(path, "utf8"))).toEqual(before);
            }
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    });

    it("reports each shared gap once and fixes it with either owning rule enabled", () => {
        const directory = mkdtempSync(join(tmpdir(), "oxlint-shared-gap-"));
        const configPath = join(directory, "oxlint.json");
        const path = join(directory, "overlap.ts");
        const cli = join(process.cwd(), "node_modules/.bin/oxlint");
        const input =
            "function run(first, second) {\n    if (first) {\n        one();\n    }\n    if (second) {\n        two();\n    }\n}\n";
        const output = input.replace("    }\n    if (second)", "    }\n\n    if (second)");
        try {
            for (const rules of [
                {
                    "blank-lines/blank-line-after-block": "warn",
                    "blank-lines/control-flow-cuddling": "warn",
                },
                { "blank-lines/blank-line-after-block": "warn" },
                { "blank-lines/control-flow-cuddling": "warn" },
            ]) {
                writeFileSync(
                    configPath,
                    JSON.stringify({
                        categories: { correctness: "off" },
                        jsPlugins: [join(process.cwd(), "dist/blank-lines/index.js")],
                        rules,
                    }),
                );
                writeFileSync(path, input);
                const initial = spawnSync(cli, ["-c", configPath, "--format", "json", path], {
                    encoding: "utf8",
                });
                expect(initial.status, initial.stderr).toBe(0);
                expect(JSON.parse(initial.stdout)).toMatchObject({
                    diagnostics: [{ filename: path, severity: "warning" }],
                });
                const fixed = spawnSync(cli, ["-c", configPath, "--fix", "--deny-warnings", path], {
                    encoding: "utf8",
                });
                expect(fixed.status, fixed.stdout + fixed.stderr).toBe(0);
                expect(readFileSync(path, "utf8")).toBe(output);
                const check = spawnSync(cli, ["-c", configPath, "--deny-warnings", path], {
                    encoding: "utf8",
                });
                expect(check.status, check.stdout + check.stderr).toBe(0);
            }
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    });
});
