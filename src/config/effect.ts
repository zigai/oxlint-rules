import type { OxlintConfig } from "oxlint";

import antislopConfig from "./index.ts";

const antislopEffectConfig: OxlintConfig = {
    ...antislopConfig,
    jsPlugins: ["oxlint-rules", "oxlint-rules/effect"],
    rules: {
        ...antislopConfig.rules,
        "antislop-effect/no-service-constructor-imports": "error",
    },
};

export default antislopEffectConfig;
