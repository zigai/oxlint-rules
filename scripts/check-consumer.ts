import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const projectDirectory = process.cwd();

function runNpm(args: readonly string[], cwd: string): string {
    const result = spawnSync(npmCommand, args, { cwd, encoding: "utf8" });
    if (result.status !== 0) {
        throw new Error(`npm ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
    }
    return result.stdout;
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
    return Array.isArray(value);
}

function parsePackedFilename(json: string): string {
    const parsed = JSON.parse(json) as unknown;
    if (!isUnknownArray(parsed) || parsed.length !== 1) {
        throw new Error("npm pack returned an unexpected manifest list");
    }
    const manifest = parsed[0];
    if (typeof manifest !== "object" || manifest === null || !("filename" in manifest)) {
        throw new Error("npm pack returned a manifest without a filename");
    }
    if (typeof manifest.filename !== "string") {
        throw new Error("npm pack returned a non-string filename");
    }
    return manifest.filename;
}

function readOxlintVersion(): string {
    const packagePath = join(projectDirectory, "node_modules", "oxlint", "package.json");
    const parsed = JSON.parse(readFileSync(packagePath, "utf8")) as unknown;
    if (typeof parsed !== "object" || parsed === null || !("version" in parsed)) {
        throw new Error("installed oxlint package must declare a version");
    }
    if (typeof parsed.version !== "string") {
        throw new Error("installed oxlint package version must be a string");
    }
    return parsed.version;
}

function expectLintFailure(
    consumerDirectory: string,
    paths: readonly string[],
    expectedRules: readonly string[],
): void {
    const result = spawnSync(npmCommand, ["exec", "--", "oxlint", ...paths], {
        cwd: consumerDirectory,
        encoding: "utf8",
    });
    const output = `${result.stdout}\n${result.stderr}`;
    if (result.status === 0) {
        throw new Error(`expected Oxlint to report a violation:\n${output}`);
    }
    for (const rule of expectedRules) {
        if (!output.includes(rule)) {
            throw new Error(`Oxlint output did not include ${rule}:\n${output}`);
        }
    }
}

const packageDirectory = mkdtempSync(join(tmpdir(), "oxlint-rules-package-"));
const consumerDirectory = mkdtempSync(join(tmpdir(), "oxlint-rules-consumer-"));

try {
    const packedFilename = parsePackedFilename(
        runNpm(
            ["pack", "--ignore-scripts", "--json", "--pack-destination", packageDirectory],
            projectDirectory,
        ),
    );
    const packagePath = join(packageDirectory, packedFilename);

    writeFileSync(
        join(consumerDirectory, "package.json"),
        JSON.stringify({ name: "oxlint-rules-consumer", private: true, type: "module" }),
        "utf8",
    );
    runNpm(
        [
            "install",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
            "--package-lock=false",
            packagePath,
            `oxlint@${readOxlintVersion()}`,
        ],
        consumerDirectory,
    );

    writeFileSync(
        join(consumerDirectory, "oxlint.config.ts"),
        `
            import { defineConfig } from "oxlint";
            import antislop from "oxlint-rules/config";

            export default defineConfig({ extends: [antislop] });
        `,
        "utf8",
    );
    writeFileSync(
        join(consumerDirectory, "fixture.ts"),
        `
            declare const input: unknown;
            const impossible = input as never;
            void impossible;
        `,
        "utf8",
    );
    expectLintFailure(
        consumerDirectory,
        ["fixture.ts"],
        ["antislop(no-never-assertions)", "antislop(require-safety-comment-for-type-assertion)"],
    );

    writeFileSync(
        join(consumerDirectory, "oxlint.config.ts"),
        `
            import { defineConfig } from "oxlint";
            import antislop from "oxlint-rules/config/effect";

            export default defineConfig({ extends: [antislop] });
        `,
        "utf8",
    );
    mkdirSync(join(consumerDirectory, "src"));
    writeFileSync(
        join(consumerDirectory, "src", "runtime.ts"),
        `
            import { makeIssueService } from "./issue-service.ts";
            void makeIssueService;
        `,
        "utf8",
    );
    expectLintFailure(
        consumerDirectory,
        ["src/runtime.ts"],
        ["antislop-effect(no-service-constructor-imports)"],
    );

    process.stdout.write("packed package works in a clean consumer project.\n");
} finally {
    rmSync(packageDirectory, { force: true, recursive: true });
    rmSync(consumerDirectory, { force: true, recursive: true });
}
