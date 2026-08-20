import type { OxlintConfig } from "oxlint";

import { antislopRules } from "../antislop/rules.ts";
import { enableRules } from "./enable-rules.ts";

const antislopConfig: OxlintConfig = {
    jsPlugins: ["oxlint-rules"],
    rules: enableRules("antislop", antislopRules),
};

export default antislopConfig;
