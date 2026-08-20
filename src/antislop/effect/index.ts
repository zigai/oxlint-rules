import { eslintCompatPlugin } from "@oxlint/plugins";

import { antislopEffectRules } from "./rules.ts";

/** Opt-in antislop rules for Effect service and Layer architecture. */
const antislopEffectPlugin = eslintCompatPlugin({
    meta: { name: "antislop-effect" },
    rules: antislopEffectRules,
});

export default antislopEffectPlugin;
