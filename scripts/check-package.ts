import { spawnSync } from "node:child_process";

function isUnknownArray(value: unknown): value is readonly unknown[] {
    return Array.isArray(value);
}

function parsePackedPaths(json: string): ReadonlySet<string> {
    const parsed = JSON.parse(json) as unknown;
    if (!isUnknownArray(parsed) || parsed.length !== 1) {
        throw new Error("npm pack returned an unexpected manifest list");
    }

    const manifest = parsed[0];
    if (typeof manifest !== "object" || manifest === null || !("files" in manifest)) {
        throw new Error("npm pack returned a manifest without files");
    }
    const files = manifest.files;
    if (!isUnknownArray(files)) {
        throw new Error("npm pack returned a non-array files field");
    }

    const paths = new Set<string>();
    for (const file of files) {
        if (typeof file !== "object" || file === null || !("path" in file)) {
            throw new Error("npm pack returned a file without a path");
        }
        const path = file.path;
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
    "dist/config/effect.js",
    "dist/config/index.js",
    "dist/index.js",
    "docs/rules.md",
    "third-party/anti-slop/LICENSE",
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
