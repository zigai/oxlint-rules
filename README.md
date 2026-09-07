# Oxlint Rules

[![npm version](https://img.shields.io/npm/v/oxlint-rules.svg?color=blue)](https://www.npmjs.com/package/oxlint-rules)
[![npm downloads](https://img.shields.io/npm/dm/oxlint-rules.svg)](https://www.npmjs.com/package/oxlint-rules)
[![license](https://img.shields.io/npm/l/oxlint-rules.svg)](LICENSE)

A collection of custom Oxlint rules and presets for TypeScript projects.

## Install

Requires Node.js 22.19+ and Oxlint 1.78.x or later within major version 1.

```sh
npm install --save-dev oxlint@^1.78.0 oxlint-rules
```

## Setup

Create `oxlint.config.ts` in your project root:

```ts
import { defineConfig } from "oxlint";
import antislop from "oxlint-rules/config";
import blankLines from "oxlint-rules/config/blank-lines";

export default defineConfig({
  extends: [antislop, blankLines],
});
```

This enables the general rules as **errors** and the default blank-line rules as **warnings**. Each preset works independently; include the ones you want. In an existing config, add the imports and presets to your `extends` array.

Check your code, then apply available whitespace fixes:

```sh
npx oxlint .
npx oxlint --fix .
```

Blank-line rules support autofixing. General and Effect rules report diagnostics that need manual changes. You can keep using your formatter alongside the blank-line rules.

### Presets

| Config import                     | Enables                                                                |
| --------------------------------- | ---------------------------------------------------------------------- |
| `oxlint-rules/config`             | All 16 general `antislop` rules as errors.                             |
| `oxlint-rules/config/effect`      | General rules plus the Effect service-constructor rule, all as errors. |
| `oxlint-rules/config/blank-lines` | 11 default blank-line rules as warnings.                               |

The general and Effect presets do not include blank-line rules. Add `oxlint-rules/config/blank-lines` separately to use the default formatting rules. For a different selection, register the plugins and configure individual rules manually.

For an Effect project, replace the general preset with the Effect preset:

```ts
import { defineConfig } from "oxlint";
import antislopEffect from "oxlint-rules/config/effect";
import blankLines from "oxlint-rules/config/blank-lines";

export default defineConfig({
  extends: [antislopEffect, blankLines],
});
```

### Customize rules

Use fully qualified rule names in `rules`. Set a severity to `"off"`, `"warn"`, or `"error"`; use an array to supply options:

```ts
import { defineConfig } from "oxlint";
import antislop from "oxlint-rules/config";
import blankLines from "oxlint-rules/config/blank-lines";

export default defineConfig({
  extends: [antislop, blankLines],
  rules: {
    "antislop/no-module-mocking": "off",
    "antislop/no-runtime-typeof": ["error", { allowInTypeGuards: true }],
    "blank-lines/switch-case-spacing": ["warn", { longCase: "always", shortCase: "any" }],
  },
});
```

### Enable individual rules

Register the relevant plugins with `jsPlugins` and enable only the rules you want from this package:

```ts
import { defineConfig } from "oxlint";

export default defineConfig({
  jsPlugins: ["oxlint-rules", "oxlint-rules/blank-lines"],
  rules: {
    "antislop/no-never-assertions": "error",
    "blank-lines/switch-case-spacing": "warn",
  },
});
```

For individual `antislop-effect/*` rules, register `"oxlint-rules/effect"`. Direct plugin registration does not apply preset rules or test-file overrides.

## Rules

### Antislop

| Rule                                                 | Description                                                                       | Autofix |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- | ------- |
| `antislop/no-chained-type-assertions`                | Reject nested assertions that discard type evidence.                              | No      |
| `antislop/no-conditional-empty-object-spread`        | Reject conditional spreads that use `{}` to omit fields.                          | No      |
| `antislop/no-known-value-widening`                   | Reject broad annotations that discard a known value's type information.           | No      |
| `antislop/no-module-mocking`                         | Reject Vitest and Jest module mocks.                                              | No      |
| `antislop/no-never-assertions`                       | Reject assertions to `never`.                                                     | No      |
| `antislop/no-object-parameters`                      | Reject the broad `object` type on function inputs.                                | No      |
| `antislop/no-reflect-apply`                          | Reject `Reflect.apply` in favor of typed calls.                                   | No      |
| `antislop/no-reflect-get`                            | Reject `Reflect.get` in favor of typed access or boundary parsing.                | No      |
| `antislop/no-runtime-typeof`                         | Restrict runtime `typeof` checks, with configurable exceptions.                   | No      |
| `antislop/no-shape-in-symbol-names`                  | Reject `shape` in symbol names.                                                   | No      |
| `antislop/no-unknown-parameters`                     | Restrict `unknown` inputs to `cause` parameters and recognized parser boundaries. | No      |
| `antislop/no-unknown-returns`                        | Reject return contracts containing `unknown` or `Promise<unknown>`.               | No      |
| `antislop/no-unknown-type-aliases`                   | Reject type aliases that conceal `unknown`.                                       | No      |
| `antislop/no-unsafe-dictionary-type`                 | Reject dictionaries with unsafe, broadly typed values.                            | No      |
| `antislop/no-widen-then-assert`                      | Reject widening a value to a broad type and later asserting it back.              | No      |
| `antislop/require-safety-comment-for-type-assertion` | Require a `SAFETY:` explanation for non-const assertions.                         | No      |
| `antislop-effect/no-service-constructor-imports`     | Reject relative `make<Capability>` constructor imports outside test files.        | No      |

### Blank lines

| Rule                                          | Description                                                                            | Autofix |
| --------------------------------------------- | -------------------------------------------------------------------------------------- | ------- |
| `blank-lines/blank-line-after-block`          | Separate block-like statements from following work, with grouping exceptions.          | Yes     |
| `blank-lines/blank-line-before-exit`          | Separate exits in larger bodies while keeping small operation-and-exit bodies compact. | Yes     |
| `blank-lines/block-boundary-spacing`          | Control blank padding inside braces.                                                   | Yes     |
| `blank-lines/comment-group-spacing`           | Control spacing around standalone comments.                                            | Yes     |
| `blank-lines/control-flow-cuddling`           | Keep related setup and control flow together; separate unrelated statements.           | Yes     |
| `blank-lines/declaration-group-spacing`       | Group declarations and their immediate uses.                                           | Yes     |
| `blank-lines/expression-group-spacing`        | Group calls, assignments, awaits, and other expression statements.                     | Yes     |
| `blank-lines/lines-between-class-members`     | Control spacing between fields, methods, accessors, and static blocks.                 | Yes     |
| `blank-lines/lines-between-type-members`      | Control spacing between interface, type-literal, and enum members.                     | Yes     |
| `blank-lines/max-consecutive-blank-lines`     | Limit repeated blank lines, including at file boundaries.                              | Yes     |
| `blank-lines/padding-line-between-statements` | Configure spacing with ordered statement-pair rules; enable manually.                  | Yes     |
| `blank-lines/switch-case-spacing`             | Keep switch cases compact by default, with options to separate them.                   | Yes     |

## License

[MIT](LICENSE).
