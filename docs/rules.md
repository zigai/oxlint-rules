# Rule configuration

Options and configuration details for configurable rules in `oxlint-rules`.

For installation, setup, presets, and the full rule catalog, see the [README](../README.md).

## Antislop rules

### `antislop/no-runtime-typeof`

Disallows runtime `typeof` checks in favor of decoding values at I/O boundaries.

```json
{
  "antislop/no-runtime-typeof": [
    "error",
    {
      "allowFunctionChecks": false,
      "allowInTypeGuards": false
    }
  ]
}
```

| Option                | Type    | Default | Description                                                                      |
| --------------------- | ------- | ------- | -------------------------------------------------------------------------------- |
| `allowFunctionChecks` | boolean | `false` | Allow `typeof x === "function"` checks (e.g. for callbacks or callable objects). |
| `allowInTypeGuards`   | boolean | `false` | Allow `typeof` checks inside TypeScript type guard functions (`x is T`).         |

### `antislop/no-unknown-parameters`

Requires function parameters to accept typed domain values instead of `unknown`.

```json
{
  "antislop/no-unknown-parameters": [
    "error",
    {
      "allowInTypeGuards": false
    }
  ]
}
```

| Option              | Type    | Default | Description                                                               |
| ------------------- | ------- | ------- | ------------------------------------------------------------------------- |
| `allowInTypeGuards` | boolean | `false` | Allow `unknown` parameters in TypeScript type guard functions (`x is T`). |

#### Permitted `unknown` parameters

An `unknown` parameter is allowed without options if:

- It is named `cause` (for error chaining).
- It is immediately passed to a recognized schema parser or validator, and the parsed output is used.

#### Recognized parsers

| Library / Style          | Recognized pattern                             | Notes                                                 |
| ------------------------ | ---------------------------------------------- | ----------------------------------------------------- |
| **Zod / Schema objects** | `.parse(val)`, `.safeParse(val)`               | Must use the parsed result rather than the raw input. |
| **TypeBox**              | `Value.Parse(schema, val)`                     | `.Check()` alone validates but does not decode.       |
| **Valibot**              | `parse(schema, val)`, `safeParse(schema, val)` | Must resolve to a named import from `valibot`.        |
| **Decoder objects**      | `.decode(val)`, `.safeDecode(val)`             | Must use the decoded result or handle typed failure.  |

Top-level local helper functions are followed if the raw parameter has a single read and immediately delegates to a recognized parser.

## Blank-line rules

Blank-line rules enforce consistent vertical spacing and support autofixing with `oxlint --fix`.

### Shared statement grouping

Several blank-line rules (`blank-line-after-block`, `blank-line-before-exit`, `control-flow-cuddling`, `declaration-group-spacing`, `expression-group-spacing`) share compaction options. These keep closely related statements grouped together without empty lines.

All options default to `true`:

| Option                       | Default | Behavior                                                                                   |
| ---------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| `compactShortBodies`         | `true`  | Group small bodies (2–3 simple statements ending in `return` or `throw`).                  |
| `compactInitializations`     | `true`  | Group leading single-line declarations and simple updates.                                 |
| `compactConditionalUpdates`  | `true`  | Group adjacent short branches or guards updating the same variable or object.              |
| `compactErrorHandlers`       | `true`  | Keep short `catch` blocks ending in `throw` compact.                                       |
| `compactWrappedDeclarations` | `true`  | Keep multiline wrapped declarations attached to immediate uses.                            |
| `compactRelatedControlFlow`  | `true`  | Group adjacent guard clauses or loops that share condition bindings.                       |
| `compactDestructuredSetup`   | `true`  | Group small destructuring setup sequences with their immediate consumer.                   |
| `compactTryFinally`          | `true`  | Keep setup calls attached to a `try/finally` block when `finally` cleans up that resource. |

#### Heuristics and boundaries

- **Statement budget**: Compaction only applies to small statements (~30 AST nodes or fewer) and excludes nested function or class declarations.
- **Direct usage**: Statements stay grouped when they directly read or mutate variables from the preceding line. References inside closures or callbacks create a boundary and are not grouped.
- **Jumps & exits**: `break` and `continue` stay attached to preceding blocks; returns after loops keep their separation.

### `blank-lines/switch-case-spacing`

Controls spacing between `case` and `default` blocks in `switch` statements.

```json
{
  "blank-lines/switch-case-spacing": [
    "warn",
    {
      "maxCuddledLines": 2,
      "longCase": "never",
      "shortCase": "never",
      "emptyCase": "never",
      "ignoreFallthrough": true
    }
  ]
}
```

| Option              | Type    | Default   | Description                                                                                       |
| ------------------- | ------- | --------- | ------------------------------------------------------------------------------------------------- |
| `maxCuddledLines`   | number  | `2`       | Non-blank body line threshold distinguishing short cases from long cases.                         |
| `longCase`          | policy  | `"never"` | Blank line policy before cases longer than `maxCuddledLines` (`"always"`, `"never"`, or `"any"`). |
| `shortCase`         | policy  | `"never"` | Blank line policy before short cases.                                                             |
| `emptyCase`         | policy  | `"never"` | Blank line policy between consecutive empty fallthrough cases.                                    |
| `ignoreFallthrough` | boolean | `true`    | Preserve existing spacing for fallthrough cases without a terminating jump.                       |

### `blank-lines/control-flow-cuddling`

Controls spacing between control flow (`if`, `for`, `while`, `switch`) and related preceding setup code.

```json
{
  "blank-lines/control-flow-cuddling": [
    "warn",
    {
      "maxCuddledStatements": 3,
      "allowBodyUsage": "any",
      "compactRelatedSetup": true,
      "includeAssignments": true
    }
  ]
}
```

| Option                 | Type    | Default | Description                                                                                                                              |
| ---------------------- | ------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `maxCuddledStatements` | number  | `3`     | Maximum related setup statements to keep attached to the control-flow block.                                                             |
| `allowBodyUsage`       | string  | `"any"` | How body references count as related setup: `"any"` (anywhere in body), `"first"` (first statement only), or `"never"` (condition only). |
| `compactRelatedSetup`  | boolean | `true`  | Remove blank lines before a group of related single-line setup statements.                                                               |
| `includeAssignments`   | boolean | `true`  | Treat variable assignments and updates as related setup.                                                                                 |

### `blank-lines/comment-group-spacing`

Controls spacing around standalone comments.

```json
{
  "blank-lines/comment-group-spacing": [
    "warn",
    {
      "beforeLine": "always",
      "afterLine": "any",
      "beforeBlock": "always",
      "afterBlock": "any"
    }
  ]
}
```

| Option        | Type   | Default    | Description                                                                |
| ------------- | ------ | ---------- | -------------------------------------------------------------------------- |
| `beforeLine`  | policy | `"always"` | Spacing before standalone line comments (`//`).                            |
| `afterLine`   | policy | `"any"`    | Spacing after standalone line comments (`"any"` preserves author spacing). |
| `beforeBlock` | policy | `"always"` | Spacing before standalone block comments (`/* */`).                        |
| `afterBlock`  | policy | `"any"`    | Spacing after standalone block comments.                                   |

### Test files and phase spacing

Test files (`*.test.*`, `*.spec.*`) often use blank lines to separate test phases (Arrange, Act, Assert).

The default `blank-lines` preset automatically applies test overrides (`testRules`) that disable compaction of declarations and expressions in test files. This preserves intentional phase boundaries without inspecting test framework APIs.

When building a custom configuration without `extends`, import and apply `testRules` manually:

```ts
import { defineConfig } from "oxlint";
import { testFiles, testRules } from "oxlint-rules/blank-lines";

export default defineConfig({
  // ...
  overrides: [
    {
      files: testFiles,
      rules: testRules,
    },
  ],
});
```
