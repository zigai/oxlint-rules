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

function isUnknownRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractManifest(parsed: unknown): Readonly<Record<string, unknown>> {
    if (isUnknownArray(parsed) && parsed.length === 1) {
        const item = parsed[0];
        if (isUnknownRecord(item)) {
            return item;
        }
    }
    if (isUnknownRecord(parsed)) {
        const values = Object.values(parsed);
        if (values.length === 1) {
            const item = values[0];
            if (isUnknownRecord(item)) {
                return item;
            }
        }
    }
    throw new Error("npm pack returned an unexpected manifest format");
}

function parsePackedFilename(json: string): string {
    const parsed: unknown = JSON.parse(json);
    const manifest = extractManifest(parsed);
    const filename = manifest["filename"];
    if (typeof filename !== "string") {
        throw new Error("npm pack returned a non-string filename");
    }
    return filename;
}

function readOxlintVersion(): string {
    const packagePath = join(projectDirectory, "node_modules", "oxlint", "package.json");
    const parsed: unknown = JSON.parse(readFileSync(packagePath, "utf8"));
    if (!isUnknownRecord(parsed)) {
        throw new Error("installed oxlint package must declare a version");
    }
    const version = parsed["version"];
    if (typeof version !== "string") {
        throw new Error("installed oxlint package version must be a string");
    }
    return version;
}

function expectLintFailure(
    consumerDirectory: string,
    paths: readonly string[],
    expectedRules: readonly string[],
): void {
    const executable =
        process.platform === "win32"
            ? join(consumerDirectory, "node_modules", ".bin", "oxlint.cmd")
            : join(consumerDirectory, "node_modules", ".bin", "oxlint");
    const result = spawnSync(executable, [...paths], {
        cwd: consumerDirectory,
        encoding: "utf8",
    });
    const output = `${result.stdout}\n${result.stderr}`;

    if (result.status === 0) {
        throw new Error(`expected oxlint failure in consumer project, but it exited 0:\n${output}`);
    }

    for (const expectedRule of expectedRules) {
        if (!output.includes(expectedRule)) {
            throw new Error(
                `oxlint output did not contain expected rule "${expectedRule}":\n${output}`,
            );
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

    writeFileSync(
        join(consumerDirectory, "oxlint.config.ts"),
        `
            import { defineConfig } from "oxlint";
            import blankLines from "oxlint-rules/config/blank-lines";

            export default defineConfig({ extends: [blankLines] });
        `,
        "utf8",
    );
    writeFileSync(
        join(consumerDirectory, "blank-lines-fixture.ts"),
        `
            declare const check: () => boolean;
            declare const read: () => string;
            declare const run: () => void;
            declare const other: boolean;
            const ready = check();
            if (ready) {
                run();
            }
            const value = read();
            if (other) {
                run();
            }
        `,
        "utf8",
    );
    expectLintFailure(
        consumerDirectory,
        ["--deny-warnings", "blank-lines-fixture.ts"],
        ["blank-lines(control-flow-cuddling)"],
    );

    process.stdout.write("packed package works in a clean consumer project.\n");
} finally {
    rmSync(packageDirectory, { force: true, recursive: true });
    rmSync(consumerDirectory, { force: true, recursive: true });
}
