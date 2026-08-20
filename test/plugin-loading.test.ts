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
});
