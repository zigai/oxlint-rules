import type { OxlintConfig } from "oxlint";

const antislopConfig: OxlintConfig = {
    jsPlugins: ["oxlint-rules"],
    rules: {
        "antislop/no-chained-type-assertions": "error",
        "antislop/no-conditional-empty-object-spread": "error",
        "antislop/no-known-value-widening": "error",
        "antislop/no-module-mocking": "error",
        "antislop/no-never-assertions": "error",
        "antislop/no-object-parameters": "error",
        "antislop/no-reflect-apply": "error",
        "antislop/no-reflect-get": "error",
        "antislop/no-runtime-typeof": "error",
        "antislop/no-shape-in-symbol-names": "error",
        "antislop/no-unknown-parameters": "error",
        "antislop/no-unknown-returns": "error",
        "antislop/no-unknown-type-aliases": "error",
        "antislop/no-unsafe-dictionary-type": "error",
        "antislop/no-widen-then-assert": "error",
        "antislop/require-safety-comment-for-type-assertion": "error",
    },
};

export default antislopConfig;
