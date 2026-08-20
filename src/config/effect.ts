import type { OxlintConfig } from "oxlint";

import { antislopEffectRules } from "../antislop/effect/rules.ts";
import { enableRules } from "./enable-rules.ts";
import antislopConfig from "./index.ts";

const antislopEffectConfig: OxlintConfig = {
    ...antislopConfig,
    jsPlugins: ["oxlint-rules", "oxlint-rules/effect"],
    rules: {
        ...antislopConfig.rules,
        ...enableRules("antislop-effect", antislopEffectRules),
    },
};

export default antislopEffectConfig;
