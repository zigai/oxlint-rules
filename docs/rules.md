# Rules

The shared config enables every rule below as an error. All rules are
diagnostic-only.

## antislop

| Rule                                        | Description                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `no-chained-type-assertions`                | Reject nested assertions that discard type evidence.                                       |
| `no-conditional-empty-object-spread`        | Reject conditional spreads that use `{}` to omit fields.                                   |
| `no-known-value-widening`                   | Reject broad annotations that discard evidence from a known value.                         |
| `no-module-mocking`                         | Reject Vitest and Jest module mocks in favor of explicit dependency seams.                 |
| `no-never-assertions`                       | Reject assertions to `never`; use control-flow exhaustiveness instead.                     |
| `no-object-parameters`                      | Reject the broad `object` type on function inputs.                                         |
| `no-reflect-apply`                          | Reject `Reflect.apply` in favor of typed function calls.                                   |
| `no-reflect-get`                            | Reject `Reflect.get` in favor of typed property access or boundary parsing.                |
| `no-runtime-typeof`                         | Require boundary parsing instead of ad hoc `typeof` narrowing.                             |
| `no-shape-in-symbol-names`                  | Reject `shape` in symbol names.                                                            |
| `no-unknown-parameters`                     | Reject `unknown` inputs unless named `cause` or immediately passed to a recognized parser. |
| `no-unknown-returns`                        | Reject function contracts returning `unknown` or `Promise<unknown>`.                       |
| `no-unknown-type-aliases`                   | Reject aliases that conceal `unknown`.                                                     |
| `no-unsafe-dictionary-type`                 | Reject dictionary values based on `unknown`, `any`, `object`, `{}`, or equivalent aliases. |
| `no-widen-then-assert`                      | Reject values widened to a broad type and later asserted back.                             |
| `require-safety-comment-for-type-assertion` | Require non-const assertions to document their checked invariant with `SAFETY:`.           |

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

## antislop-effect

| Rule                             | Description                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `no-service-constructor-imports` | Reject relative imports of `make<Capability>` constructors outside test files; runtime code should use the owning Effect Layer. |

The collection is based on
[dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) and may differ from
its source. See [third-party notices](../THIRD_PARTY_NOTICES.md).
