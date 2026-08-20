import { eslintCompatPlugin } from "@oxlint/plugins";

import { antislopRules } from "./rules.ts";

/** Generic Oxlint rules derived from dmmulroy/anti-slop. */
const antislopPlugin = eslintCompatPlugin({
    meta: { name: "antislop" },
    rules: antislopRules,
});

export default antislopPlugin;
