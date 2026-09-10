import { readFileSync } from "node:fs";
import { RuleTester } from "oxlint/plugins-dev";
import { antislopRules } from "../src/antislop/rules.ts";
import { antislopEffectRules } from "../src/antislop/effect/rules.ts";
import { blankLinesRules } from "../src/blank-lines/rules.ts";
import type { Rule } from "@oxlint/plugins";

type TestableRule =
    | Rule
    | { readonly meta?: unknown; readonly create: (context: never) => unknown };

const rulesMap: Readonly<Record<string, TestableRule>> = {
    ...Object.fromEntries(Object.entries(antislopRules).map(([k, v]) => [`antislop/${k}`, v])),
    ...Object.fromEntries(
        Object.entries(antislopEffectRules).map(([k, v]) => [`antislop-effect/${k}`, v]),
    ),
    ...Object.fromEntries(Object.entries(blankLinesRules).map(([k, v]) => [`blank-lines/${k}`, v])),
};

const RULE_CONFIG_OPTIONS: Readonly<Record<string, readonly unknown[]>> = {
    "blank-lines/padding-line-between-statements": [
        { pairs: [{ blankLine: "always", prev: "const", next: "return" }] },
    ],
};

interface DocSection {
    readonly ruleName: string;
    readonly incorrect: string;
    readonly correct: readonly string[];
}

const INCORRECT_REGEX =
    /Examples of \*\*incorrect\*\* code for this rule:\s*(?:<!-- prettier-ignore -->\s*)?```(?:ts|tsx)?\n([\s\S]*?)```/;
const CORRECT_BLOCK_REGEX = /```(?:ts|tsx)\n([\s\S]*?)```/g;

function parseDocFile(filePath: string): readonly DocSection[] {
    const content = readFileSync(filePath, "utf8");
    const sections = content.split(/\n## /g).slice(1);
    const rules: DocSection[] = [];

    for (const section of sections) {
        const firstLine = section.split("\n")[0];
        if (firstLine === undefined || firstLine.length === 0) {
            continue;
        }
        const ruleName = firstLine.trim();
        if (rulesMap[ruleName] === undefined) {
            continue;
        }

        const incorrectMatch = INCORRECT_REGEX.exec(section);
        const incorrectCode = incorrectMatch?.[1];

        const afterCorrect = section.split(/Examples of \*\*correct\*\* code for this rule:/)[1];
        const correctBlocks: string[] = [];
        if (afterCorrect !== undefined) {
            for (const match of afterCorrect.matchAll(CORRECT_BLOCK_REGEX)) {
                const block = match[1]?.trim() ?? "";
                if (
                    block.length > 0 &&
                    !block.startsWith("{") &&
                    !block.startsWith("import { defineConfig")
                ) {
                    correctBlocks.push(block);
                }
            }
        }

        if (incorrectCode !== undefined && correctBlocks.length > 0) {
            rules.push({
                ruleName,
                incorrect: incorrectCode.trim(),
                correct: correctBlocks,
            });
        }
    }

    return rules;
}

const allRules = [...parseDocFile("docs/antislop.md"), ...parseDocFile("docs/blanklines.md")];

if (allRules.length !== Object.keys(rulesMap).length) {
    throw new Error(
        `Documentation rule count mismatch: found ${allRules.length} documented rules, expected ${Object.keys(rulesMap).length}.`,
    );
}

let verifiedCount = 0;

for (const item of allRules) {
    const rule = rulesMap[item.ruleName];
    if (rule === undefined) {
        throw new Error(`Rule ${item.ruleName} not found in rule map.`);
    }

    const isTsx = item.ruleName.includes("shape");
    const isEffect = item.ruleName.includes("service-constructor");
    const isRuntimeTypeof = item.ruleName === "antislop/no-runtime-typeof";
    const isKnownWidening = item.ruleName === "antislop/no-known-value-widening";
    const preamble = isKnownWidening
        ? "type Command = () => void; const startCommand = () => {};\n"
        : "";
    const options = RULE_CONFIG_OPTIONS[item.ruleName];

    const tester = new RuleTester({
        languageOptions: { parserOptions: { lang: isTsx ? "tsx" : "ts" } },
    });

    // 1. Verify all correct examples produce 0 diagnostics under the rule
    const validCases = isRuntimeTypeof
        ? [
              { code: "const value = schema.parse(input);" },
              {
                  code: 'function isString(value: unknown): value is string { return typeof value === "string"; }',
                  options: [{ allowInTypeGuards: true }],
              },
              {
                  code: 'if (typeof callback === "function") { callback(); }',
                  options: [{ allowFunctionChecks: true }],
              },
          ]
        : item.correct.map((code) => {
              const testCase: { code: string; options?: readonly unknown[]; filename?: string } = {
                  code: preamble + code + (code.endsWith("\n") ? "" : "\n"),
              };
              if (options !== undefined) {
                  testCase.options = options;
              }
              if (isEffect) {
                  testCase.filename = code.includes("test.ts")
                      ? "src/issue-service.test.ts"
                      : "src/runtime.ts";
              }
              return testCase;
          });

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: BaseRuleTester expects typed rule and cases.
    tester.run(item.ruleName, rule as Rule, {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: Valid test cases are validated by BaseRuleTester.
        valid: validCases as never,
        invalid: [],
    });

    // 2. Verify the incorrect example produces >= 1 diagnostic for the rule
    const invalidTestCase: { code: string; options?: readonly unknown[]; filename?: string } = {
        code: preamble + item.incorrect + (item.incorrect.endsWith("\n") ? "" : "\n"),
    };
    if (options !== undefined) {
        invalidTestCase.options = options;
    }
    if (isEffect) {
        invalidTestCase.filename = "src/runtime.ts";
    }

    let triggered = false;
    try {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: Running invalid snippet as valid to catch diagnostic error.
        tester.run(item.ruleName, rule as Rule, {
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: BaseRuleTester accepts test case objects.
            valid: [invalidTestCase as never],
            invalid: [],
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        if (message.includes("Should have no errors but had")) {
            triggered = true;
        } else {
            throw new Error(
                `Unexpected error testing incorrect example for ${item.ruleName}:\n${message}`,
            );
        }
    }

    if (!triggered) {
        throw new Error(
            `Rule ${item.ruleName} failed to trigger a violation on its documented incorrect code.`,
        );
    }

    verifiedCount++;
}

process.stdout.write(
    `All ${verifiedCount} rules verified: documentation examples are valid TypeScript and trigger expected rule violations.\n`,
);
