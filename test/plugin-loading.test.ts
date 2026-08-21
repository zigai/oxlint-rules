import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const oxlintPath = join(process.cwd(), "node_modules", ".bin", "oxlint");
const antislopPluginPath = join(process.cwd(), "dist", "index.js");

describe("compiled plugin", () => {
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
});
