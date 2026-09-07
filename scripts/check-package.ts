import { spawnSync } from "node:child_process";

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

function parsePackedPaths(json: string): ReadonlySet<string> {
    const parsed: unknown = JSON.parse(json);
    const manifest = extractManifest(parsed);
    const files = manifest["files"];
    if (!isUnknownArray(files)) {
        throw new Error("npm pack returned a non-array files field");
    }

    const paths = new Set<string>();
    for (const file of files) {
        if (!isUnknownRecord(file)) {
            throw new Error("npm pack returned a file that is not an object");
        }
        const path = file["path"];
        if (typeof path !== "string") {
            throw new Error("npm pack returned a non-string file path");
        }
        paths.add(path);
    }
    return paths;
}

const result = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    encoding: "utf8",
});

if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
}

const paths = parsePackedPaths(result.stdout);
const requiredPaths = [
    "LICENSE",
    "README.md",
    "THIRD_PARTY_NOTICES.md",
    "dist/antislop/effect/index.js",
    "dist/antislop/index.js",
    "dist/blank-lines/index.js",
    "dist/config/blank-lines.js",
    "dist/config/effect.js",
    "dist/config/index.js",
    "dist/index.js",
    "docs/rules.md",
];
const missingPaths = requiredPaths.filter((path) => !paths.has(path));

if (missingPaths.length > 0) {
    throw new Error(`npm package is missing required files: ${missingPaths.join(", ")}`);
}

const mapPaths = [...paths].filter((path) => path.endsWith(".map"));
if (mapPaths.length > 0) {
    throw new Error(`npm package contains unexpected map files: ${mapPaths.join(", ")}`);
}

process.stdout.write(`npm package contains ${paths.size} files and all required notices.\n`);
