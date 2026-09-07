import type { AllowWarnDeny, DummyRule, OxlintConfig } from "oxlint";

import { recommendedRules, testRules, testFiles } from "../blank-lines/recommended.ts";

function toOxlintRules(
    rules: Readonly<Record<string, readonly [AllowWarnDeny, ...unknown[]]>>,
): Record<string, DummyRule> {
    const result: Record<string, DummyRule> = {};
    for (const [key, value] of Object.entries(rules)) {
        result[key] = [value[0], ...value.slice(1)];
    }
    return result;
}

export const recommendedConfig: OxlintConfig = {
    jsPlugins: ["oxlint-rules/blank-lines"],
    rules: toOxlintRules(recommendedRules),
    overrides: [{ files: testFiles, rules: toOxlintRules(testRules) }],
};

export default recommendedConfig;
