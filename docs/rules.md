# Advanced rule configuration

See the [README](../README.md) for installation, setup, presets, and the complete
rule table. This reference covers rule options, defaults, and grouping exceptions.

## General rules

### `no-runtime-typeof`

```ts
{
  "antislop/no-runtime-typeof": [
    "error",
    { "allowFunctionChecks": true, "allowInTypeGuards": true }
  ]
}
```

Both options default to `false`. `allowFunctionChecks` permits equality checks
against `"function"` for identity-sensitive callable host seams.
`allowInTypeGuards` permits `typeof` in functions with a TypeScript
type-predicate return type. This is an explicit schema-free opt-out: moving a
check into a type guard is not the preferred fix for schema-driven projects.

### `no-unknown-parameters`

```ts
{
  "antislop/no-unknown-parameters": ["error", { "allowInTypeGuards": true }]
}
```

`allowInTypeGuards` defaults to `false`. Enable it together with
`no-runtime-typeof`'s matching option only in schema-free code that uses complete
TypeScript type predicates to parse identity-sensitive host objects.

The rule permits an `unknown` parameter only when it is named `cause`, defines
the input of a recognized parser contract, or is read once and immediately
passed to a recognized parser. Built-in parser integrations include:

| Library style                  | Recognized form                                    | Requirement                                                 |
| ------------------------------ | -------------------------------------------------- | ----------------------------------------------------------- |
| Zod and similar schema objects | `.parse(value)`, `.safeParse(value)`               | Use the parser result rather than the original input.       |
| TypeBox compiled validators    | `.Parse(value)`                                    | `.Check(value)` alone is not decoding.                      |
| Decoder objects                | `.decode(value)`, `.safeDecode(value)`             | Use the decoded result or typed failure.                    |
| Valibot                        | `parse(schema, value)`, `safeParse(schema, value)` | The function must resolve to a named import from `valibot`. |

Local top-level parser helpers are followed only when the raw parameter has one
read and each helper immediately delegates to another recognized parser. This
syntactic recognition does not prove that parsing is complete: the parser must
return the concrete owner/domain value, and raw input must not continue inward.

## Blank-line rules

The blank-line default config enables warnings and supports whitespace autofixes with
`oxlint --fix`. The options below customize their spacing behavior.

### Switch cases

Long, short, and empty cases stay together by default (`longCase`, `shortCase`,
and `emptyCase` are `"never"`). Nonempty cases without a terminating statement
retain their spacing through `ignoreFallthrough: true`.

To separate long terminating cases and preserve existing spacing after short cases:

```json
{
  "blank-lines/switch-case-spacing": ["warn", { "longCase": "always", "shortCase": "any" }]
}
```

`maxCuddledLines` defaults to 2 nonblank body lines and controls the long-case threshold.

### Statement grouping

The blank-line default config compacts consecutive single-line variable
declarations and preserve spacing around multiline declarations. Direct uses stay
attached to their declarations; references inside nested functions and classes do
not count as direct uses. This preserves boundaries before callback registration
and returned objects containing methods. Unread destructuring bindings are ignored
by the relationship check, regardless of their names.

The statement rules share these options, enabled by default:

| Option                       | Behavior                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compactShortBodies`         | Compact bodies containing two or three simple statements ending in an exit. This includes calls, awaited calls, and logging before an exit.                               |
| `compactDestructuredSetup`   | Group a small destructuring/update/declaration sequence when all used outputs feed the update or the immediately following loop, and the new declaration feeds that loop. |
| `compactTryFinally`          | Attach a small setup call to a try whose finally contains one small cleanup call on the same receiver and arguments.                                                      |
| `compactErrorHandlers`       | Keep short catch bodies ending in a throw compact, including in test files.                                                                                               |
| `compactWrappedDeclarations` | Attach a small wrapped declaration to an immediate expression or exit that reads its bindings.                                                                            |
| `compactRelatedControlFlow`  | Group adjacent small return/throw guards or same-kind loops whose conditions read a common binding.                                                                       |
| `compactInitializations`     | Group a leading sequence of two or three single-line declarations and simple updates.                                                                                     |
| `compactConditionalUpdates`  | Group adjacent short branches updating the same variable or object, including small setup declarations and returning the updated object.                                  |

Simple statements have an AST budget of 30 nodes. They exclude nested
functions/classes, except that a small declaration may bind the result of a call
with an inline callback. Direct declarations of closures or method objects,
callback registrations, and returned method objects retain their boundaries. Conditional update branches contain at most two simple mutation statements.
These bounds keep large constructions separated and do not change merely because
Oxfmt wraps a call, declaration, or unbraced condition. Wrapped declarations can
participate in short bodies and immediate-use grouping; initialization-prefix
compaction still requires single-line declarations. Small control-flow groups
require a single simple body statement and at most 30 AST nodes per branch or
loop. Shared predicate function names alone do not establish a relationship.

Declaration grouping also exposes `compactSingleLineDeclarations` and
`compactRelatedUse`. The latter attaches an uninitialized declaration to a
following `try` when the first statement initializes it. Exit spacing exposes
`compactAfterSingleLine` for existing declaration/update-plus-exit sequences.

Loop and switch jumps (`break` and `continue`, including labeled jumps) stay
attached to a preceding control-flow block through
`compactJumpsAfterBlock: true`. Block spacing exempts these jumps through
`exceptBefore: ["break", "continue"]`. Returns after loops keep their separation.

Try/finally pairing compares resolved receiver and argument paths or primitive literals.
It does not infer cleanup semantics from method names, match dynamic argument calls,
or group arbitrary setup with a try. Both `compactTryFinally` and
`compactDestructuredSetup` can be disabled. These options do not change the
existing return-spacing policy: small whole bodies stay compact, while longer
functions can retain a blank line before their final return.

### Control-flow relationships

`control-flow-cuddling` permits up to three related setup statements by default
(`maxCuddledStatements: 3`). Both the condition and direct body references count
(`allowBodyUsage: "any"`); use `"first"` to restrict body matching to its first
statement. `compactRelatedSetup: true` removes padding before a related small
single-line setup group; multiline setup retains its existing padding.

`requireAllBindings` applies to bindings that are actually read in the program.
Relationships use resolved variables and static property paths, including literal
computed properties and scoped computed identifiers. Updating one property does
not count as updating an unrelated property on the same object. Conditional
construction groups may update different fields of the same receiver.

`includeAssignments` includes assignments and increment/decrement updates.
Expression grouping treats `void call()` as a call and `delete target.property`
as an assignment for grouping purposes. Existing expression-group spacing options
still apply.

Expression grouping's `allowAssignmentBeforeControlFlow` yields spacing to the
control-flow rule for both assignment and update statements.

### Test files and comments

Test overrides disable destructured-setup, wrapped-declaration, and related-control-flow compaction,
but keep `compactErrorHandlers` enabled so capture-and-rethrow stays together.

The blank-line default config includes overrides for
`*.test.*` and `*.spec.*` in supported JS/TS extensions. These overrides preserve
existing declaration and expression group boundaries, including setup, action,
and assertions. They do not inspect test-framework callee names. Helpers in those
files also retain their existing phase spacing. The overrides are exported as
`testRules` from `oxlint-rules/blank-lines` for custom configurations.

Use the complete config through `extends`. If merging configs manually, preserve
both `rules` and `overrides`; spreading only `rules` omits test-file behavior.

Comment spacing preserves the gap after explanatory comments and skips comments
inside expressions so formatting and linting agree. `afterLine` and
`afterBlock` can be set explicitly when padding after standalone comments is
wanted. Comments and literal contents are never removed by statement grouping.
Exclude generated files with consumer overrides; their generators own formatting.
