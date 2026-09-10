import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { recommendedRules } from "../src/blank-lines/recommended.ts";

const oxlintPath = join(process.cwd(), "node_modules", ".bin", "oxlint");
const antislopPluginPath = join(process.cwd(), "dist", "index.js");

describe("compiled plugin", () => {
    it("preserves consumer grouping and converges with Oxfmt using the full preset", () => {
        const directory = mkdtempSync(join(tmpdir(), "oxlint-rules-consumer-spacing-"));
        const configPath = join(directory, "oxlint.json");
        const fixtures = [
            'const KEY = Symbol.for("key");\nconst ENV = "ENV";\nconst OTHER = "OTHER";\n',
            "function rotate(filePath) {\n    try {\n        if (isSmall(filePath)) {\n            return;\n        }\n\n        const rotatedPath = `${filePath}.1`;\n        rmSync(rotatedPath, { force: true });\n        renameSync(filePath, rotatedPath);\n    } catch (cause) {\n        throw cause;\n    }\n}\n",
            "function configure(enabled) {\n    if (current === enabled) {\n        return false;\n    }\n\n    current = enabled;\n    return true;\n}\n",
            'function normalize(text) {\n    const neutralized = clean(text);\n    return neutralized.includes("\\t") ? expand(neutralized) : neutralized;\n}\n',
            'function scan(args) {\n    let index = 0;\n    while (index < args.length) {\n        const argument = args[index];\n        if (argument === undefined) {\n            return [];\n        }\n\n        if (argument === "-u") {\n            index += 2;\n            continue;\n        }\n\n        if (argument === "-S" || argument === "-i") {\n            index += 1;\n            continue;\n        }\n        break;\n    }\n\n    return args.slice(index);\n}\n',
            `switch (value) {
    case 1:
        work();
        return;

    case 2:
        return;
}
`,
            'it("first", () => {\n    setup();\n\n    expect(result).toBe(true);\n});\n\nit("second", () => {\n    run();\n});\n',
            "const parseA = {\n    parse() { return 1; },\n};\n\nconst parseB = {\n    parse() { return 2; },\n};\n",
            "type First = {\n    value: string;\n};\n\ntype Second = {\n    count: number;\n};\n",
            "function run() {\n    // Explain the operation.\n    work();\n}\n",
            "const width =\n    count +\n    // Extra padding.\n    2;\n",
            "const unrelated = read();\nconst ready = check();\nif (ready) {\n    run();\n}\n",
            "const node = <div>\n\n\n  Hello\n\n\n  world\n\n\n</div>;\n",
        ];
        writeFileSync(
            configPath,
            JSON.stringify({
                categories: { correctness: "off" },
                jsPlugins: [
                    {
                        name: "blank-lines",
                        specifier: join(process.cwd(), "dist/blank-lines/index.js"),
                    },
                ],
                rules: recommendedRules,
            }),
        );
        try {
            const paths = fixtures.map((code, index) => {
                const path = join(directory, `fixture-${index}.tsx`);
                writeFileSync(path, code);
                return path;
            });
            const fixed = spawnSync(oxlintPath, ["-c", configPath, "--fix", ...paths], {
                encoding: "utf8",
            });
            expect(fixed.status, fixed.stdout + fixed.stderr).toBe(0);
            expect(paths.map((path) => readFileSync(path, "utf8"))).toEqual(fixtures);
            const formatter = join(process.cwd(), "node_modules/.bin/oxfmt");
            for (let pass = 0; pass < 2; pass += 1) {
                const formatted = spawnSync(formatter, paths, { encoding: "utf8" });
                expect(formatted.status, formatted.stdout + formatted.stderr).toBe(0);
                const before = paths.map((path) => readFileSync(path, "utf8"));
                const check = spawnSync(oxlintPath, ["-c", configPath, ...paths], {
                    encoding: "utf8",
                });
                expect(check.status, check.stdout + check.stderr).toBe(0);
                const fix = spawnSync(oxlintPath, ["-c", configPath, "--fix", ...paths], {
                    encoding: "utf8",
                });
                expect(fix.status, fix.stdout + fix.stderr).toBe(0);
                expect(paths.map((path) => readFileSync(path, "utf8"))).toEqual(before);
            }
        } finally {
            rmSync(directory, { force: true, recursive: true });
        }
    });
    it("loads through the Oxlint CLI and reports its public rule names", () => {
        const directory = mkdtempSync(join(tmpdir(), "oxlint-rules-"));
        const fixturePath = join(directory, "fixture.ts");
        const configPath = join(directory, "oxlint.json");

        writeFileSync(
            fixturePath,
            `
                declare const input: unknown;
                const impossible = input as never;
                function stringify(value: unknown): string { return String(value); }
                void impossible;
                void stringify;
            `,
            "utf8",
        );
        writeFileSync(
            configPath,
            JSON.stringify({
                jsPlugins: [{ name: "antislop", specifier: antislopPluginPath }],
                rules: {
                    "antislop/no-never-assertions": "error",
                    "antislop/no-unknown-parameters": "error",
                },
            }),
            "utf8",
        );

        try {
            const result = spawnSync(oxlintPath, ["-c", configPath, fixturePath], {
                encoding: "utf8",
            });
            const output = `${result.stdout}\n${result.stderr}`;

            expect(result.status).not.toBe(0);
            expect(output).toContain("antislop(no-never-assertions)");
            expect(output).toContain("antislop(no-unknown-parameters)");
        } finally {
            rmSync(directory, { force: true, recursive: true });
        }
    });

    it("accepts supported schema parser contracts through the Oxlint CLI", () => {
        const directory = mkdtempSync(join(tmpdir(), "oxlint-rules-parsers-"));
        const fixturePath = join(directory, "fixture.ts");
        const configPath = join(directory, "oxlint.json");

        writeFileSync(
            fixturePath,
            `
                import { safeParse } from "valibot";

                interface TypeBoxValidator {
                    Parse(value: unknown): string;
                }
                type ZodParser = {
                    parse: (value: unknown) => string;
                };
                declare const typebox: TypeBoxValidator;
                declare const zod: ZodParser;
                declare const valibotSchema: object;

                export function parseTypeBox(input: unknown): string {
                    return typebox.Parse(input);
                }
                export function parseZod(input: unknown): string {
                    return zod.parse(input);
                }
                export function parseValibot(input: unknown): object {
                    return safeParse(valibotSchema, input);
                }

                export const parser = {
                    parse(value: unknown): string {
                        return String(value);
                    },
                };

                export function isString(value: unknown): value is string {
                    return typeof value === "string";
                }

                export function callIfFunction(callback: (() => void) | undefined): void {
                    if (typeof callback === "function") callback();
                }
            `,
            "utf8",
        );
        writeFileSync(
            configPath,
            JSON.stringify({
                jsPlugins: [{ name: "antislop", specifier: antislopPluginPath }],
                rules: {
                    "antislop/no-runtime-typeof": [
                        "error",
                        { allowFunctionChecks: true, allowInTypeGuards: true },
                    ],
                    "antislop/no-unknown-parameters": ["error", { allowInTypeGuards: true }],
                },
            }),
            "utf8",
        );

        try {
            const result = spawnSync(oxlintPath, ["-c", configPath, fixturePath], {
                encoding: "utf8",
            });
            expect(result.status).toBe(0);
            const output = `${result.stdout}\n${result.stderr}`;
            expect(output).not.toContain("antislop(no-runtime-typeof)");
            expect(output).not.toContain("antislop(no-unknown-parameters)");
        } finally {
            rmSync(directory, { force: true, recursive: true });
        }
    });

    it("does not retain createOnce rule state between files", () => {
        const directory = mkdtempSync(join(tmpdir(), "oxlint-rules-state-"));
        const aliasPath = join(directory, "a-defines-alias.ts");
        const consumerPath = join(directory, "z-uses-name.ts");
        const configPath = join(directory, "oxlint.json");

        writeFileSync(aliasPath, "type ExternalInput = object;", "utf8");
        writeFileSync(
            consumerPath,
            "function accept(value: ExternalInput): void { void value; }",
            "utf8",
        );
        writeFileSync(
            configPath,
            JSON.stringify({
                jsPlugins: [{ name: "antislop", specifier: antislopPluginPath }],
                rules: { "antislop/no-object-parameters": "error" },
            }),
            "utf8",
        );

        try {
            const result = spawnSync(
                oxlintPath,
                ["--threads=1", "-c", configPath, aliasPath, consumerPath],
                { encoding: "utf8" },
            );

            expect(result.status).toBe(0);
            expect(`${result.stdout}\n${result.stderr}`).not.toContain(
                "antislop(no-object-parameters)",
            );
        } finally {
            rmSync(directory, { force: true, recursive: true });
        }
    });

    it("loads blank-lines plugin and applies whitespace autofixes through Oxlint CLI", () => {
        const directory = mkdtempSync(join(tmpdir(), "oxlint-rules-blank-lines-"));
        const fixturePath = join(directory, "fixture.ts");
        const configPath = join(directory, "oxlint.json");
        const blankLinesPluginPath = join(process.cwd(), "dist", "blank-lines", "index.js");

        writeFileSync(
            fixturePath,
            "const ready = check();\nif (ready) {\n    run();\n}\nconst unused = read();\nif (other) {\n    run();\n}\n",
            "utf8",
        );
        writeFileSync(
            configPath,
            JSON.stringify({
                jsPlugins: [{ name: "blank-lines", specifier: blankLinesPluginPath }],
                rules: {
                    "blank-lines/control-flow-cuddling": "error",
                },
            }),
            "utf8",
        );

        try {
            const checkResult = spawnSync(oxlintPath, ["-c", configPath, fixturePath], {
                encoding: "utf8",
            });
            expect(checkResult.status).not.toBe(0);
            expect(`${checkResult.stdout}\n${checkResult.stderr}`).toContain(
                "blank-lines(control-flow-cuddling)",
            );

            const fixResult = spawnSync(oxlintPath, ["--fix", "-c", configPath, fixturePath], {
                encoding: "utf8",
            });
            expect(fixResult.status).toBe(0);
            const content = readFileSync(fixturePath, "utf8");
            expect(content).toContain("const unused = read();\n\nif (other)");
            expect(content).toContain("const ready = check();\nif (ready)");
        } finally {
            rmSync(directory, { force: true, recursive: true });
        }
    });
});
