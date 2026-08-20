import { describe, expect, it } from "vitest";

import antislopEffectConfig from "../src/config/effect.ts";
import antislopConfig from "../src/config/index.ts";

describe("shared configs", () => {
    it("enables the complete antislop ruleset", () => {
        expect(antislopConfig.jsPlugins).toEqual(["oxlint-rules"]);
        expect(Object.keys(antislopConfig.rules ?? {})).toHaveLength(16);
        expect(antislopConfig.rules?.["antislop/no-never-assertions"]).toBe("error");
    });

    it("adds the optional Effect plugin and rule", () => {
        expect(antislopEffectConfig.jsPlugins).toEqual(["oxlint-rules", "oxlint-rules/effect"]);
        expect(Object.keys(antislopEffectConfig.rules ?? {})).toHaveLength(17);
        expect(antislopEffectConfig.rules?.["antislop-effect/no-service-constructor-imports"]).toBe(
            "error",
        );
    });
});
