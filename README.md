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

Create `oxlint.config.ts`:

```ts
import { defineConfig } from "oxlint";
import antislop from "oxlint-rules/config";
import blankLines from "oxlint-rules/config/blank-lines";

export default defineConfig({
  extends: [antislop, blankLines],
});
```

For Effect projects, import `oxlint-rules/config/effect` instead of `oxlint-rules/config`.

Run Oxlint:

```sh
npx oxlint .
npx oxlint --fix .
```

### Presets

| Preset          | Import                            | Behavior                                                           |
| --------------- | --------------------------------- | ------------------------------------------------------------------ |
| **General**     | `oxlint-rules/config`             | 16 general type-safety rules as **errors**.                        |
| **Effect**      | `oxlint-rules/config/effect`      | General rules plus Effect service-constructor check as **errors**. |
| **Blank lines** | `oxlint-rules/config/blank-lines` | 11 vertical spacing rules as **warnings** (autofixable).           |

### Customization

Override severity or pass options in `rules`:

```ts
export default defineConfig({
  extends: [antislop, blankLines],
  rules: {
    "antislop/no-module-mocking": "off",
    "antislop/no-runtime-typeof": ["error", { allowInTypeGuards: true }],
    "blank-lines/switch-case-spacing": ["warn", { longCase: "always", shortCase: "any" }],
  },
});
```

## Rules

### Antislop

| Rule                                                                                                                       | Description                                                                       | Autofix |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------- |
| [`antislop/no-chained-type-assertions`](docs/antislop.md#antislopno-chained-type-assertions)                               | Reject nested assertions that discard type evidence.                              | No      |
| [`antislop/no-conditional-empty-object-spread`](docs/antislop.md#antislopno-conditional-empty-object-spread)               | Reject conditional spreads that use `{}` to omit fields.                          | No      |
| [`antislop/no-known-value-widening`](docs/antislop.md#antislopno-known-value-widening)                                     | Reject broad annotations that discard a known value's type information.           | No      |
| [`antislop/no-module-mocking`](docs/antislop.md#antislopno-module-mocking)                                                 | Reject Vitest and Jest module mocks.                                              | No      |
| [`antislop/no-never-assertions`](docs/antislop.md#antislopno-never-assertions)                                             | Reject assertions to `never`.                                                     | No      |
| [`antislop/no-object-parameters`](docs/antislop.md#antislopno-object-parameters)                                           | Reject the broad `object` type on function inputs.                                | No      |
| [`antislop/no-reflect-apply`](docs/antislop.md#antislopno-reflect-apply)                                                   | Reject `Reflect.apply` in favor of typed calls.                                   | No      |
| [`antislop/no-reflect-get`](docs/antislop.md#antislopno-reflect-get)                                                       | Reject `Reflect.get` in favor of typed access or boundary parsing.                | No      |
| [`antislop/no-runtime-typeof`](docs/antislop.md#antislopno-runtime-typeof)                                                 | Restrict runtime `typeof` checks, with configurable exceptions.                   | No      |
| [`antislop/no-shape-in-symbol-names`](docs/antislop.md#antislopno-shape-in-symbol-names)                                   | Reject `shape` in symbol names.                                                   | No      |
| [`antislop/no-unknown-parameters`](docs/antislop.md#antislopno-unknown-parameters)                                         | Restrict `unknown` inputs to `cause` parameters and recognized parser boundaries. | No      |
| [`antislop/no-unknown-returns`](docs/antislop.md#antislopno-unknown-returns)                                               | Reject return contracts containing `unknown` or `Promise<unknown>`.               | No      |
| [`antislop/no-unknown-type-aliases`](docs/antislop.md#antislopno-unknown-type-aliases)                                     | Reject type aliases that conceal `unknown`.                                       | No      |
| [`antislop/no-unsafe-dictionary-type`](docs/antislop.md#antislopno-unsafe-dictionary-type)                                 | Reject dictionaries with unsafe, broadly typed values.                            | No      |
| [`antislop/no-widen-then-assert`](docs/antislop.md#antislopno-widen-then-assert)                                           | Reject widening a value to a broad type and later asserting it back.              | No      |
| [`antislop/require-safety-comment-for-type-assertion`](docs/antislop.md#antisloprequire-safety-comment-for-type-assertion) | Require a `SAFETY:` explanation for non-const assertions.                         | No      |
| [`antislop-effect/no-service-constructor-imports`](docs/antislop.md#antislop-effectno-service-constructor-imports)         | Reject relative `make<Capability>` constructor imports outside test files.        | No      |

### Blank lines

| Rule                                                                                                           | Description                                                                            | Autofix |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------- |
| [`blank-lines/blank-line-after-block`](docs/blanklines.md#blank-linesblank-line-after-block)                   | Separate block-like statements from following work, with grouping exceptions.          | Yes     |
| [`blank-lines/blank-line-before-exit`](docs/blanklines.md#blank-linesblank-line-before-exit)                   | Separate exits in larger bodies while keeping small operation-and-exit bodies compact. | Yes     |
| [`blank-lines/block-boundary-spacing`](docs/blanklines.md#blank-linesblock-boundary-spacing)                   | Control blank padding inside braces.                                                   | Yes     |
| [`blank-lines/comment-group-spacing`](docs/blanklines.md#blank-linescomment-group-spacing)                     | Control spacing around standalone comments.                                            | Yes     |
| [`blank-lines/control-flow-cuddling`](docs/blanklines.md#blank-linescontrol-flow-cuddling)                     | Keep related setup and control flow together; separate unrelated statements.           | Yes     |
| [`blank-lines/declaration-group-spacing`](docs/blanklines.md#blank-linesdeclaration-group-spacing)             | Group declarations and their immediate uses.                                           | Yes     |
| [`blank-lines/expression-group-spacing`](docs/blanklines.md#blank-linesexpression-group-spacing)               | Group calls, assignments, awaits, and other expression statements.                     | Yes     |
| [`blank-lines/lines-between-class-members`](docs/blanklines.md#blank-lineslines-between-class-members)         | Control spacing between fields, methods, accessors, and static blocks.                 | Yes     |
| [`blank-lines/lines-between-type-members`](docs/blanklines.md#blank-lineslines-between-type-members)           | Control spacing between interface, type-literal, and enum members.                     | Yes     |
| [`blank-lines/max-consecutive-blank-lines`](docs/blanklines.md#blank-linesmax-consecutive-blank-lines)         | Limit repeated blank lines, including at file boundaries.                              | Yes     |
| [`blank-lines/padding-line-between-statements`](docs/blanklines.md#blank-linespadding-line-between-statements) | Configure spacing with ordered statement-pair rules; enable manually.                  | Yes     |
| [`blank-lines/switch-case-spacing`](docs/blanklines.md#blank-linesswitch-case-spacing)                         | Keep switch cases compact by default, with options to separate them.                   | Yes     |

## License

[MIT](LICENSE)
