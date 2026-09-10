# Antislop Rules

Custom Oxlint rules for TypeScript type safety, boundary validation, and code health.

- [`antislop/no-chained-type-assertions`](#antislopno-chained-type-assertions)
- [`antislop/no-conditional-empty-object-spread`](#antislopno-conditional-empty-object-spread)
- [`antislop/no-known-value-widening`](#antislopno-known-value-widening)
- [`antislop/no-module-mocking`](#antislopno-module-mocking)
- [`antislop/no-never-assertions`](#antislopno-never-assertions)
- [`antislop/no-object-parameters`](#antislopno-object-parameters)
- [`antislop/no-reflect-apply`](#antislopno-reflect-apply)
- [`antislop/no-reflect-get`](#antislopno-reflect-get)
- [`antislop/no-runtime-typeof`](#antislopno-runtime-typeof)
- [`antislop/no-shape-in-symbol-names`](#antislopno-shape-in-symbol-names)
- [`antislop/no-unknown-parameters`](#antislopno-unknown-parameters)
- [`antislop/no-unknown-returns`](#antislopno-unknown-returns)
- [`antislop/no-unknown-type-aliases`](#antislopno-unknown-type-aliases)
- [`antislop/no-unsafe-dictionary-type`](#antislopno-unsafe-dictionary-type)
- [`antislop/no-widen-then-assert`](#antislopno-widen-then-assert)
- [`antislop/require-safety-comment-for-type-assertion`](#antisloprequire-safety-comment-for-type-assertion)
- [`antislop-effect/no-service-constructor-imports`](#antislop-effectno-service-constructor-imports)

---

## antislop/no-chained-type-assertions

### What it does

Disallows chained or nested TypeScript type assertions (e.g. `x as unknown as T` or `<T><unknown>x`), while permitting chains that consist entirely of `const` assertions.

### Why is this bad?

Chained assertions like `as unknown as T` bypass TypeScript's type checker and discard compiler-checked type evidence. They create an escape hatch that forces an incompatible type onto an expression without any validation, hiding potential runtime errors. Values should instead be decoded or validated at boundaries using schemas or type guards.

### Examples

Examples of **incorrect** code for this rule:

```ts
const value = input as unknown as string;
const coerced = <string>(<unknown>input);
```

Examples of **correct** code for this rule:

```ts
const value = input as string;
const literal = input as const;
const length = (input as string)?.length;
```

---

## antislop/no-conditional-empty-object-spread

### What it does

Disallows conditional spreads that spread an empty object literal `{}` in one branch to conditionally omit properties (e.g. `{ ...(condition ? { a } : {}) }`).

### Why is this bad?

Spreading empty object literals `{}` adds unnecessary runtime overhead, generates bloated JavaScript output, and muddies TypeScript's property inference. Conditional properties should be assigned explicitly, set to `undefined`, or constructed using distinct object literals.

### Examples

Examples of **incorrect** code for this rule:

```ts
const user = { ...(value !== undefined ? { value } : {}) };
const config = { ...(condition ? {} : { value }) };
```

Examples of **correct** code for this rule:

```ts
const user = { value };
const copy = { ...values };
const settings = condition ? { value } : {};
```

---

## antislop/no-known-value-widening

### What it does

Rejects broad type annotations (such as `unknown`, `object`, or index signatures) on variables, return types, or properties where the assigned value has a specific, known literal shape.

### Why is this bad?

Annotating a known object literal with a broad type like `unknown`, `object`, or `Record<string, Command>` immediately discards the exact keys and types known at compile time. Use TypeScript's `satisfies` operator or `as const` to verify interface conformance without losing specific type information.

### Examples

Examples of **incorrect** code for this rule:

```ts
const untypedValue: unknown = {};
const broadObject: object = {};
const commandMap: Record<string, Command> = { start: startCommand };
function create(): unknown {
  return {};
}
```

Examples of **correct** code for this rule:

```ts
// Empty initializations are permitted:
const commandRegistry: Record<string, Command> = {};

// Use satisfies or as const for literals:
const commands = { start: startCommand } satisfies Record<string, Command>;
const immutableCommands = { start: startCommand } as const;

// Interface and type declarations:
interface Commands {
  readonly start: Command;
}
const typedCommands: Commands = { start: startCommand };
```

---

## antislop/no-module-mocking

### What it does

Disallows Vitest (`vi.mock()`, `vi.doMock()`) and Jest (`jest.mock()`, `jest.unstable_mockModule()`) module-level mocking.

### Why is this bad?

Module mocking mutates runtime module registries globally, introduces hidden coupling between test suites, obscures architectural dependencies, and breaks TypeScript type guarantees. Prefer dependency injection, interface-based abstractions, or in-memory test doubles instead of patching module loaders.

### Examples

Examples of **incorrect** code for this rule:

```ts
vi.mock("./user-store");
jest.mock("./user-store");
vi["doMock"]("./user-store");
jest.unstable_mockModule("./user-store");
```

Examples of **correct** code for this rule:

```ts
// Use dependency injection or test doubles:
const store = new InMemoryUserStore();
const service = new UserService(store);

// Spying on methods is allowed:
vi.spyOn(store, "save");
```

---

## antislop/no-never-assertions

### What it does

Disallows type assertions to `never` (e.g. `value as never` or `<never>value`).

### Why is this bad?

The `never` type represents values that cannot occur. Manually casting values to `never` subverts compiler exhaustiveness checking and corrupts control flow analysis. Instead, use exhaustive pattern matching or type narrowing so TypeScript proves exhaustiveness naturally.

### Examples

Examples of **incorrect** code for this rule:

```ts
const value = input as never;
const fallback = <never>input;
```

Examples of **correct** code for this rule:

```ts
type Event = { readonly type: "open" } | { readonly type: "close" };

function handle(event: Event): string {
  switch (event.type) {
    case "open":
      return "opened";
    case "close":
      return "closed";
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}
```

---

## antislop/no-object-parameters

### What it does

Rejects the broad `object` type as an annotation on function parameters.

### Why is this bad?

The `object` type matches any non-primitive value (objects, arrays, functions, dates) without exposing any accessible properties. Using `object` makes function contracts vague and forces callers or implementations into unsafe assertions. Functions should require specific interfaces, record types, or generic type parameters.

### Examples

Examples of **incorrect** code for this rule:

```ts
function handle(value: object) {}

type Handler = (value: object) => void;
```

Examples of **correct** code for this rule:

```ts
interface User {
  readonly id: string;
}
function handle(value: User) {}

function handleGeneric<Value extends object>(value: Value) {}
```

---

## antislop/no-reflect-apply

### What it does

Disallows `Reflect.apply` in favor of typed function calls or `Function.prototype.apply`.

### Why is this bad?

`Reflect.apply` bypasses TypeScript's compile-time parameter validation and return type inference, degrading function invocation into untyped operations. Use standard typed calls (`fn(...args)`) or direct method invocations.

### Examples

Examples of **incorrect** code for this rule:

```ts
const value = Reflect.apply(operation, owner, args);
const result = Reflect["apply"](operation, owner, args);
```

Examples of **correct** code for this rule:

```ts
const value = operation.apply(owner, args);
const result = operation(...args);
```

---

## antislop/no-reflect-get

### What it does

Disallows `Reflect.get` in favor of typed property access or boundary decoding.

### Why is this bad?

`Reflect.get` is an untyped reflection method that returns `any`, circumventing TypeScript's type safety and hiding missing property bugs. Use standard property access (`owner.property` or `owner[key]`) or validated schema parsers when dealing with external data.

### Examples

Examples of **incorrect** code for this rule:

```ts
const value = Reflect.get(owner, key);
const prop = Reflect["get"](owner, key);
```

Examples of **correct** code for this rule:

```ts
const value = owner.property;
const prop = owner[key];
```

---

## antislop/no-runtime-typeof

### What it does

Restricts runtime `typeof` checks (`typeof x === "string"`), encouraging explicit boundary decoding with configurable exceptions for type guards and function checks.

### Why is this bad?

Scattering primitive `typeof` checks throughout domain logic often substitutes for proper boundary validation. Values entering an application should be parsed and decoded into strong domain models at the I/O edge (via Zod, Valibot, TypeBox, etc.) rather than checked ad-hoc in internal functions.

### Examples

Examples of **incorrect** code for this rule:

```ts
if (typeof input === "string") {
  use(input);
}
```

Examples of **correct** code for this rule:

```ts
// Decode at boundary:
const value = schema.parse(input);

// With allowInTypeGuards enabled:
function isString(value: unknown): value is string {
  return typeof value === "string";
}

// With allowFunctionChecks enabled:
if (typeof callback === "function") {
  callback();
}
```

### Configuration

| Option                | Type      | Default | Description                                                                                  |
| --------------------- | --------- | ------- | -------------------------------------------------------------------------------------------- |
| `allowFunctionChecks` | `boolean` | `false` | Allow `typeof x === "function"` checks (e.g. for optional callbacks or handlers).            |
| `allowInTypeGuards`   | `boolean` | `false` | Allow `typeof` checks inside TypeScript type guard functions (`x is T` or `asserts x is T`). |

---

## antislop/no-shape-in-symbol-names

### What it does

Disallows the term `shape` (case-insensitive) in identifier names, type names, interfaces, functions, and JSX components.

### Why is this bad?

Naming symbols `*Shape` (such as `userShape`, `responseShape`, or `ShapeFactory`) is redundant and vague "slop" that leaks structural framing into domain names. The type or interface itself expresses the shape; prefer meaningful domain names (e.g. `User`, `UserDTO`, `ResponseData`, `Schema`).

### Examples

Examples of **incorrect** code for this rule:

```tsx
const responseShape = {};
type ShapeFactory = () => object;
const view = <ShapePanel />;
```

Examples of **correct** code for this rule:

```tsx
const responseData = {};
type EntityFactory = () => object;
const view = <EntityPanel />;
```

---

## antislop/no-unknown-parameters

### What it does

Restricts `unknown` typed function parameters to `cause` error parameters and recognized schema parser boundaries.

### Why is this bad?

Functions that accept `unknown` defer validation to the function body, weakening interface contracts and encouraging defensive runtime checks. Function boundaries should demand specific domain types, leaving input validation to dedicated parsers at the system edge.

### Examples

Examples of **incorrect** code for this rule:

```ts
function process(input: unknown) {
  console.log(input);
}
```

Examples of **correct** code for this rule:

```ts
// Typed domain input:
function process(input: User) {
  console.log(input.id);
}

// Error chaining allows `cause: unknown`:
function wrap(cause: unknown): Error {
  return new Error("Failed", { cause });
}

// Immediate delegation to a parser (Zod, Valibot, TypeBox, etc.):
function parseUser(input: unknown): User {
  return userSchema.parse(input);
}
```

### Configuration

| Option              | Type      | Default | Description                                                                   |
| ------------------- | --------- | ------- | ----------------------------------------------------------------------------- |
| `allowInTypeGuards` | `boolean` | `false` | Allow `unknown` parameters in TypeScript type guard functions (`value is T`). |

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
---

## antislop/no-unknown-returns

### What it does

Rejects return type annotations containing `unknown` or `Promise<unknown>`.

### Why is this bad?

Returning `unknown` shifts the burden of validation onto every caller, spreading untyped data across the codebase. Functions should return specific domain types, validated results, or generic type parameters.

### Examples

Examples of **incorrect** code for this rule:

```ts
function load(): unknown {
  return input;
}

const fetchItem = (): Promise<unknown> => {
  return fetch(url);
};

type Loader = () => unknown;
```

Examples of **correct** code for this rule:

```ts
function load(): User {
  return user;
}

function fetchItem(): Promise<User> {
  return fetchUser(url);
}

function generic<Value>(): Value {
  return value;
}
```

---

## antislop/no-unknown-type-aliases

### What it does

Disallows type aliases that directly alias `unknown`.

### Why is this bad?

Writing `type Alias = unknown;` or `type JsonValue = unknown;` conceals the untyped nature of `unknown` behind a domain-sounding label, giving a misleading impression of type safety without providing any real guarantees.

### Examples

Examples of **incorrect** code for this rule:

```ts
type Alias = unknown;
type Current = unknown;
type UnknownValue = unknown;
```

Examples of **correct** code for this rule:

```ts
type UserId = string;
type User = { readonly id: UserId };
```

---

## antislop/no-unsafe-dictionary-type

### What it does

Disallows dictionary and index signature types with unsafe values such as `unknown`, `any`, or `object` (e.g. `Record<string, unknown>`, `{ [key: string]: any }`).

### Why is this bad?

Dictionaries with `unknown` or `any` values disable compiler type checks across all property accesses, letting code read arbitrary keys without validation. Use typed record maps, union types, or validated schemas.

### Examples

Examples of **incorrect** code for this rule:

```ts
type Bag = Record<string, unknown>;
type Registry = { [key: string]: any };
type Lookup = { [K in PropertyKey]: object };
```

Examples of **correct** code for this rule:

```ts
type Commands = Record<string, Command>;
type Metadata = Record<string, JsonValue>;
type Permissions = Record<Permission, number>;
type Allowed = Record<string, { payload: unknown }>;
```

---

## antislop/no-widen-then-assert

### What it does

Disallows widening a value to a broad type like `unknown` and subsequently asserting it to another type.

### Why is this bad?

Widening a value (`const widened: unknown = source;`) and later asserting it (`widened as Target`) is a multi-step equivalent of `source as unknown as Target`. It bypasses the compiler's type safety checks and obscures unsafe type conversions.

### Examples

Examples of **incorrect** code for this rule:

```ts
const source = { id: "item" };
const widened: unknown = source;
const parsed = widened as { readonly id: string };
```

Examples of **correct** code for this rule:

```ts
// Preserve specific types directly:
const source: { readonly id: string } = { id: "item" };

// Decode external data at boundaries:
declare const input: unknown;
const parsed = userSchema.parse(input);
```

---

## antislop/require-safety-comment-for-type-assertion

### What it does

Requires an explicit `// SAFETY:` explanation comment directly preceding any non-const type assertion (`as T` or `<T>`).

### Why is this bad?

Type assertions override the compiler and can introduce silent runtime type errors. Requiring a `// SAFETY:` explanation forces developers to articulate why the assertion is guaranteed to be safe and what invariant prevents runtime failure.

### Examples

Examples of **incorrect** code for this rule:

```ts
const id = value as UserId;
const user = <UserId>value;

// Normal comments are rejected:
// This cast seems fine.
const name = value as UserName;
```

Examples of **correct** code for this rule:

```ts
// Const assertions do not require comments:
const values = [1, 2] as const;

// Type assertions with an explicit SAFETY: justification:
// SAFETY: The parser above validated the UserId invariant.
const id = value as UserId;
```

---

## antislop-effect/no-service-constructor-imports

### What it does

Disallows relative imports of `make<Capability>` service constructors outside of test files in Effect projects.

### Why is this bad?

In Effect applications, services should be accessed via their Service Tags and managed Layers rather than by importing and invoking their underlying `make<Capability>` constructors directly. Direct constructor imports bypass dependency injection and lifecycle management.

### Examples

Examples of **incorrect** code for this rule:

```ts
// In src/runtime.ts:
import { makeIssueService } from "./issue-service.ts";
```

Examples of **correct** code for this rule:

```ts
// In src/runtime.ts (import layer or tag):
import { issueServiceLayer } from "./issue-service.ts";

// In src/issue-service.test.ts (permitted in test files):
import { makeIssueService } from "./issue-service.ts";
```
