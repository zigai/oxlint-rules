import { describe, expect, it } from "vitest";

import { antislopEffectRules } from "../src/antislop/effect/rules.ts";
import { antislopRules } from "../src/antislop/rules.ts";
import { recommendedRules } from "../src/blank-lines/recommended.ts";
import { recommendedConfig as blankLinesConfig } from "../src/config/blank-lines.ts";
import antislopEffectConfig from "../src/config/effect.ts";
import antislopConfig from "../src/config/index.ts";

describe("shared configs", () => {
    it("enables every exported antislop rule", () => {
        expect(antislopConfig.jsPlugins).toEqual(["oxlint-rules"]);
        expect(Object.keys(antislopConfig.rules ?? {}).sort()).toEqual(
            Object.keys(antislopRules)
                .map((ruleName) => `antislop/${ruleName}`)
                .sort(),
        );
    });

    it("enables every exported antislop and Effect rule", () => {
        expect(antislopEffectConfig.jsPlugins).toEqual(["oxlint-rules", "oxlint-rules/effect"]);
        expect(Object.keys(antislopEffectConfig.rules ?? {}).sort()).toEqual(
            [
                ...Object.keys(antislopRules).map((ruleName) => `antislop/${ruleName}`),
                ...Object.keys(antislopEffectRules).map(
                    (ruleName) => `antislop-effect/${ruleName}`,
                ),
            ].sort(),
        );
    });

    it("enables recommended blank-lines rules", () => {
        expect(blankLinesConfig.jsPlugins).toEqual(["oxlint-rules/blank-lines"]);
        expect(Object.keys(blankLinesConfig.rules ?? {}).sort()).toEqual(
            Object.keys(recommendedRules).sort(),
        );
    });
});
