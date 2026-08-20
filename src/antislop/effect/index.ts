import { eslintCompatPlugin } from "@oxlint/plugins";

import { noServiceConstructorImportsRule } from "./rules/no-service-constructor-imports.ts";

/** Opt-in antislop rules for Effect service and Layer architecture. */
const antislopEffectPlugin = eslintCompatPlugin({
    meta: { name: "antislop-effect" },
    rules: {
        "no-service-constructor-imports": noServiceConstructorImportsRule,
    },
});

export default antislopEffectPlugin;
