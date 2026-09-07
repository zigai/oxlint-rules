import { describe, expect, it } from "vitest";

import blankLinesPlugin, { blankLinesRules, recommendedRules } from "../src/blank-lines/index.ts";
import { testRules } from "../src/blank-lines/recommended.ts";
import { referencedIdentifiers } from "../src/blank-lines/ast.ts";
import { RuleTester } from "./rule-tester.ts";

describe("blank-lines plugin", () => {
    it("exports plugin metadata matching Oxlint contract", () => {
        expect(blankLinesPlugin.meta.name).toBe("blank-lines");
        expect(Object.keys(blankLinesPlugin.rules).sort()).toEqual(
            Object.keys(blankLinesRules).sort(),
        );
        expect(blankLinesPlugin.configs).toBeDefined();
    });

    it("advertises layout type and whitespace autofixes for every rule", () => {
        const rules = Object.entries(blankLinesRules);
        expect(rules.length).toBe(12);
        for (const [name, rule] of rules) {
            expect(rule.meta.type, name).toBe("layout");
            expect(rule.meta.fixable, name).toBe("whitespace");
            expect(Object.keys(rule.meta.messages).length, name).toBeGreaterThan(0);
        }
    });

    it("exports valid preset rule maps", () => {
        expect(Object.keys(recommendedRules).length).toBe(11);
        expect(Object.keys(blankLinesPlugin.configs ?? {})).toEqual(["recommended"]);

        for (const ruleId of Object.keys(recommendedRules)) {
            expect(ruleId.startsWith("blank-lines/")).toBe(true);
            const shortName = ruleId.replace("blank-lines/", "");
            expect(shortName in blankLinesRules).toBe(true);
        }
    });

    it("enables all preset rules and test overrides as warnings", () => {
        const presets: readonly Readonly<Record<string, readonly [string, ...unknown[]]>>[] = [
            recommendedRules,
            testRules,
        ];
        for (const preset of presets) {
            for (const [ruleId, setting] of Object.entries(preset)) {
                expect(setting[0], ruleId).toBe("warn");
            }
        }
    });

    it("correctly identifies referenced runtime identifiers", () => {
        const expression = {
            type: "CallExpression",
            callee: { type: "Identifier", name: "check" },
            arguments: [
                { type: "Identifier", name: "value" },
                {
                    type: "ObjectExpression",
                    properties: [
                        {
                            type: "Property",
                            computed: false,
                            shorthand: false,
                            key: { type: "Identifier", name: "label" },
                            value: { type: "Identifier", name: "actual" },
                        },
                    ],
                },
            ],
            typeArguments: {
                type: "TSTypeParameterInstantiation",
                params: [
                    {
                        type: "TSTypeReference",
                        typeName: { type: "Identifier", name: "Phantom" },
                    },
                ],
            },
        };
        expect([...referencedIdentifiers(expression)].sort()).toEqual(["actual", "check", "value"]);
    });
});

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
const exitOptions = {
    ...recommendedRules["blank-lines/blank-line-before-exit"][1],
    exits: [...recommendedRules["blank-lines/blank-line-before-exit"][1].exits],
    exceptAfter: [...recommendedRules["blank-lines/blank-line-before-exit"][1].exceptAfter],
};
const testExitOptions = {
    ...testRules["blank-lines/blank-line-before-exit"][1],
    exits: [...testRules["blank-lines/blank-line-before-exit"][1].exits],
    exceptAfter: [...testRules["blank-lines/blank-line-before-exit"][1].exceptAfter],
};

tester.run("blank-lines/blank-line-before-exit", blankLinesRules["blank-line-before-exit"], {
    valid: [
        {
            options: [exitOptions],
            code: "function helper() {\n    task();\n    return 1;\n}\n",
        },
        {
            filename: "helper.test.ts",
            options: [testExitOptions],
            code: "function helper() {\n    task();\n    return 1;\n}\n",
        },
        {
            filename: "helper.test.ts",
            options: [testExitOptions],
            code: "function helper() {\n    task();\n\n    return 1;\n}\n",
        },
        {
            filename: "phases.test.ts",
            options: [testExitOptions],
            code: "function helper() {\n    const started = now();\n\n    operation();\n\n    return now() - started;\n}\n",
        },
    ],
    invalid: [
        {
            filename: "helper.test.ts",
            options: [testExitOptions],
            code: "function helper() {\n    arrange();\n    act();\n    assertResult();\n    return 1;\n}\n",
            output: "function helper() {\n    arrange();\n    act();\n    assertResult();\n\n    return 1;\n}\n",
            errors: [{ messageId: "expectedBlank" }],
        },
    ],
});

tester.run("blank-lines/declaration-group-spacing", blankLinesRules["declaration-group-spacing"], {
    valid: [
        {
            filename: "phases.test.ts",
            options: [
                {
                    ...testRules["blank-lines/declaration-group-spacing"][1],
                    groups: testRules["blank-lines/declaration-group-spacing"][1].groups.map(
                        (group) => [...group],
                    ),
                },
            ],
            code: 'it("preserves phases", () => {\n    const initial = setup();\n\n    const result = run(initial);\n\n    expect(result).toEqual(initial);\n});\n',
        },
    ],
    invalid: [],
});
