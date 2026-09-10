# Blank-line Rules

Custom Oxlint rules for vertical whitespace formatting, statement grouping, and semantic layout in TypeScript projects. All blank-line rules support autofixing with `oxlint --fix`.

- [`blank-lines/blank-line-after-block`](#blank-linesblank-line-after-block)
- [`blank-lines/blank-line-before-exit`](#blank-linesblank-line-before-exit)
- [`blank-lines/block-boundary-spacing`](#blank-linesblock-boundary-spacing)
- [`blank-lines/comment-group-spacing`](#blank-linescomment-group-spacing)
- [`blank-lines/control-flow-cuddling`](#blank-linescontrol-flow-cuddling)
- [`blank-lines/declaration-group-spacing`](#blank-linesdeclaration-group-spacing)
- [`blank-lines/expression-group-spacing`](#blank-linesexpression-group-spacing)
- [`blank-lines/lines-between-class-members`](#blank-lineslines-between-class-members)
- [`blank-lines/lines-between-type-members`](#blank-lineslines-between-type-members)
- [`blank-lines/max-consecutive-blank-lines`](#blank-linesmax-consecutive-blank-lines)
- [`blank-lines/padding-line-between-statements`](#blank-linespadding-line-between-statements)
- [`blank-lines/switch-case-spacing`](#blank-linesswitch-case-spacing)

---

## blank-lines/blank-line-after-block

### What it does

Enforces a blank line after block-like statements (`if`, `for`, `while`, `do/while`, `try`, `switch`), while permitting grouping exceptions for small related bodies, cleanup sequences, and immediate returns.

### Why is this bad?

Without visual separation, multi-line blocks blend into subsequent statements, making control flow hard to follow. Conversely, unconditionally requiring blank lines breaks tight guard patterns (such as a short if-check directly preceding a property update or return).

### Examples

Examples of **incorrect** code for this rule:

```ts
function process(state, input) {
  if (input.cached) {
    state.hits += 1;
    return;
  }
  state.attempts += 1;
  work();
}
```

Examples of **correct** code for this rule:

```ts
function process(state, input) {
  if (input.cached) {
    state.hits += 1;
    return;
  }

  state.attempts += 1;
  work();
}
```

Grouping exceptions allow compact related guards:

```ts
function restore(target, key, value) {
  if (value === undefined) {
    delete target[key];
    return;
  }
  target[key] = value;
}
```

### Configuration

This rule accepts a configuration object with shared compaction properties:

| Option                      | Type      | Default | Description                                                                   |
| --------------------------- | --------- | ------- | ----------------------------------------------------------------------------- |
| `compactShortBodies`        | `boolean` | `true`  | Group small bodies (2–3 simple statements ending in `return` or `throw`).     |
| `compactConditionalUpdates` | `boolean` | `true`  | Group adjacent short branches or guards updating the same variable or object. |
| `compactInitializations`    | `boolean` | `true`  | Group leading single-line declarations and simple updates.                    |

---

## blank-lines/blank-line-before-exit

### What it does

Enforces a blank line before exit statements (`return`, `throw`, `break`, `continue`) in larger bodies, while keeping small operation-and-exit bodies compact.

### Why is this bad?

In non-trivial functions, failing to visually separate the final return or throw from the preceding setup code obscures the transition to completion. In small, 2–3 line functions, however, an extra blank line before `return` creates pointless vertical sprawl.

### Examples

Examples of **incorrect** code for this rule:

```ts
function collect(values) {
  const result = [];
  for (const value of values) {
    result.push(value);
  }
  return result;
}
```

Examples of **correct** code for this rule:

```ts
function collect(values) {
  const result = [];
  for (const value of values) {
    result.push(value);
  }

  return result;
}
```

Small 2–3 line bodies remain compact without blank lines:

```ts
function render(item, fallback) {
  if (item === undefined) return fallback;
  return transform(item); // Small 2-3 line bodies remain compact
}
```

### Configuration

| Option               | Type               | Default   | Description                                                                                            |
| -------------------- | ------------------ | --------- | ------------------------------------------------------------------------------------------------------ |
| `shortBodySpacing`   | `"never" \| "any"` | `"never"` | Remove blank lines before short-body exits (`"never"`), or preserve existing author spacing (`"any"`). |
| `compactShortBodies` | `boolean`          | `true`    | Enable compact formatting for bodies of 2–3 simple statements.                                         |

---

## blank-lines/block-boundary-spacing

### What it does

Disallows empty lines immediately after opening braces (`{`) and immediately before closing braces (`}`) in functions, classes, control-flow blocks, and object literals.

### Why is this bad?

Blank padding inside block boundaries wastes vertical screen space and creates irregular, bloated formatting around code blocks.

### Examples

Examples of **incorrect** code for this rule:

<!-- prettier-ignore -->
```ts
function run() {

  work();

}

class Worker {

  start() {}

}
```

Examples of **correct** code for this rule:

```ts
function run() {
  work();
}

class Worker {
  start() {}
}
```

---

## blank-lines/comment-group-spacing

### What it does

Enforces consistent blank line spacing around standalone comments, while attaching suppression directives (`// @ts-expect-error`, `/* eslint-disable-next-line */`) and JSDoc blocks directly to their targets without intervening gaps.

### Why is this bad?

Inconsistent spacing around comments separates annotations from the statements they describe or clutters dense logic with arbitrary gaps.

### Examples

Examples of **incorrect** code for this rule:

```ts
work();
/* eslint-disable-next-line no-console */
console.log(value);

work();
// Comment attached without blank line before it
next();
```

Examples of **correct** code for this rule:

```ts
work();

/* eslint-disable-next-line no-console */
console.log(value);

work();

// Explanation of following work
next();

/** JSDoc documentation */ // Directives and JSDoc attach without gap
function run() {}
```

### Configuration

| Option                 | Type                           | Default    | Description                                                                                     |
| ---------------------- | ------------------------------ | ---------- | ----------------------------------------------------------------------------------------------- |
| `beforeLine`           | `"always" \| "never" \| "any"` | `"always"` | Blank line policy before standalone line comments (`//`).                                       |
| `afterLine`            | `"always" \| "never" \| "any"` | `"any"`    | Blank line policy after standalone line comments.                                               |
| `beforeBlock`          | `"always" \| "never" \| "any"` | `"always"` | Blank line policy before standalone block comments (`/* */`).                                   |
| `afterBlock`           | `"always" \| "never" \| "any"` | `"any"`    | Blank line policy after standalone block comments.                                              |
| `allowAtBlockBoundary` | `boolean`                      | `true`     | Permit comments directly following block openings or switch labels without an extra blank line. |

---

## blank-lines/control-flow-cuddling

### What it does

Keeps tightly coupled setup statements attached to the control-flow blocks (`if`, `for`, `while`, `switch`) that consume them, while separating unrelated statements with a blank line.

### Why is this bad?

Placing blank lines between a variable declaration and the `if` condition that tests it separates related logic. Conversely, failing to separate unrelated setup creates dense walls of code.

### Examples

Examples of **incorrect** code for this rule:

```ts
const ready = check();

if (ready) {
  run();
}
```

Examples of **correct** code for this rule:

```ts
const ready = check();
if (ready) {
  run();
}
```

Unrelated statements remain separated:

```ts
const unrelated = read(); // Unrelated statements are separated

const active = check();
if (active) {
  run();
}
```

### Configuration

| Option                 | Type                          | Default | Description                                                                                                                              |
| ---------------------- | ----------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `maxCuddledStatements` | `number`                      | `3`     | Maximum related setup statements to keep attached to the control-flow block.                                                             |
| `allowBodyUsage`       | `"any" \| "first" \| "never"` | `"any"` | How body references count as related setup: `"any"` (anywhere in body), `"first"` (first statement only), or `"never"` (condition only). |
| `compactRelatedSetup`  | `boolean`                     | `true`  | Remove blank lines before single-line setup whose immediate predecessor feeds the control-flow header.                                   |
| `includeAssignments`   | `boolean`                     | `true`  | Treat variable assignments and updates as related setup.                                                                                 |

---

## blank-lines/declaration-group-spacing

### What it does

Controls spacing within and between declaration groups (imports, type aliases, variables, functions, classes), keeping single-line declarations compact while separating multiline declarations or different groups.

### Why is this bad?

Inconsistent gaps between declarations disrupt code organization, making it harder to distinguish between import headers, type definitions, and implementation variables.

### Examples

Examples of **incorrect** code for this rule:

```ts
const a = 1;

const b = 2;

const first = {
  mode: "static",
};
const second = {
  enabled: true,
};
```

Examples of **correct** code for this rule:

```ts
const a = 1; // Consecutive single-line declarations stay compact
const b = 2;

const first = {
  mode: "static",
}; // Multiline declarations are separated

const second = {
  enabled: true,
};
```

### Configuration

| Option                          | Type                           | Default    | Description                                                                              |
| ------------------------------- | ------------------------------ | ---------- | ---------------------------------------------------------------------------------------- |
| `compactSingleLineDeclarations` | `boolean`                      | `true`     | Keep consecutive single-line declarations in the same group compact without blank lines. |
| `separateMultilineDeclarations` | `boolean`                      | `true`     | Separate multiline type, interface, or variable declarations.                            |
| `betweenGroups`                 | `"always" \| "never" \| "any"` | `"always"` | Blank line policy between different declaration groups (e.g. types vs variables).        |
| `withinGroup`                   | `"always" \| "never" \| "any"` | `"any"`    | Fallback blank line policy within the same declaration group.                            |
| `afterGroup`                    | `"always" \| "never" \| "any"` | `"always"` | Blank line policy after a declaration group before other statements.                     |

---

## blank-lines/expression-group-spacing

### What it does

Groups related expression statements (calls, assignments, awaits) that work together, while separating distinct execution phases with blank lines.

### Why is this bad?

A continuous sequence of expression statements without visual phase boundaries is difficult to parse mentally. Conversely, blank lines between consecutive updates to the same target fragment logical units of work.

### Examples

Examples of **incorrect** code for this rule:

```ts
function run(input) {
  release(input);
  const size = measure(input);
  consume(input);
}
```

Examples of **correct** code for this rule:

```ts
function run(input) {
  release(input);

  const size = measure(input);
  if (size === 0) return;

  consume(input);
}
```

### Configuration

| Option                      | Type                           | Default | Description                                                             |
| --------------------------- | ------------------------------ | ------- | ----------------------------------------------------------------------- |
| `beforeGroup`               | `"always" \| "never" \| "any"` | `"any"` | Blank line policy before an expression group.                           |
| `afterGroup`                | `"always" \| "never" \| "any"` | `"any"` | Blank line policy after an expression group.                            |
| `compactConditionalUpdates` | `boolean`                      | `true`  | Keep single-line conditional updates compact with adjacent expressions. |

---

## blank-lines/lines-between-class-members

### What it does

Controls vertical spacing between class members (fields, methods, accessors, static blocks), requiring blank lines around methods and accessors while keeping simple single-line fields compact.

### Why is this bad?

Missing blank lines between methods makes it hard to distinguish where one method ends and the next begins. Conversely, forcing blank lines between every single-line field inflates class definitions unnecessarily.

### Examples

Examples of **incorrect** code for this rule:

```ts
class Worker {
  start() {}
  stop() {}
}
```

Examples of **correct** code for this rule:

```ts
class Worker {
  start() {}

  stop() {}
}
```

### Configuration

| Option                   | Type                                                       | Default    | Description                                                                            |
| ------------------------ | ---------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| `default`                | `"always" \| "never" \| "any"`                             | `"always"` | Default spacing policy between class members.                                          |
| `exceptBetweenOverloads` | `boolean`                                                  | `true`     | Do not require blank lines between overload signatures of the same method.             |
| `pairs`                  | `Array<{ blankLine: string, prev: string, next: string }>` | `[]`       | Specific pair overrides (e.g. `{ blankLine: "never", prev: "field", next: "field" }`). |

---

## blank-lines/lines-between-type-members

### What it does

Controls spacing between members in TypeScript interfaces, type literals, and enums, keeping single-line members compact while separating multiline members.

### Why is this bad?

Inconsistent blank lines inside interface and type definitions disrupt the visual layout of type contracts.

### Examples

Examples of **incorrect** code for this rule:

```ts
enum Status {
  Ready,

  Done,
}
```

Examples of **correct** code for this rule:

```ts
enum Status {
  Ready,
  Done,
}
```

Interfaces with single-line members also remain compact:

```ts
interface User {
  id: string;
  name: string;
}
```

---

## blank-lines/max-consecutive-blank-lines

### What it does

Enforces a maximum number of consecutive blank lines (default: 1) throughout the file and strips blank lines at file boundaries (start and end of file).

### Why is this bad?

Multiple consecutive empty lines create excessive vertical whitespace and inconsistent spacing across a codebase.

### Examples

Examples of **incorrect** code for this rule:

<!-- prettier-ignore -->
```ts
const a = 1;



const b = 2;
```

Examples of **correct** code for this rule:

```ts
const a = 1;

const b = 2;
```

### Configuration

| Option | Type     | Default | Description                              |
| ------ | -------- | ------- | ---------------------------------------- |
| `max`  | `number` | `1`     | Maximum allowed consecutive blank lines. |

---

## blank-lines/padding-line-between-statements

### What it does

Configures customizable blank line policies between specific statement pairs (similar to ESLint's `padding-line-between-statements`).

### Why is this bad?

Provides a flexible mechanism to enforce custom statement-to-statement spacing rules where global heuristics are not sufficient.

### Examples

Examples of **incorrect** code for this rule:

```ts
function value() {
  const answer = 42;
  return answer; // Missing blank line when configured
}
```

Examples of **correct** code for this rule:

```ts
function value() {
  const answer = 42;

  return answer;
}
```

### Configuration

| Option  | Type                                                                             | Default | Description                                                                      |
| ------- | -------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------- |
| `pairs` | `Array<{ blankLine: "always" \| "never" \| "any", prev: string, next: string }>` | `[]`    | List of statement pair configurations specifying the required blank line policy. |

---

## blank-lines/switch-case-spacing

### What it does

Controls vertical spacing between `case` and `default` blocks in `switch` statements, keeping cases compact by default with options to separate long cases.

### Why is this bad?

Large blank lines between consecutive one-line cases bloat switch statements, while lack of spacing before complex multiline cases impairs readability.

### Examples

Examples of **incorrect** code for this rule:

```ts
switch (value) {
  case 1: {
    const item = read();
    process(item);
    return item;
  }

  case 2: // Unnecessary blank line before case
    return;
}
```

Examples of **correct** code for this rule:

```ts
switch (value) {
  case 1: {
    const item = read();
    process(item);
    return item;
  }
  case 2: // Compact cases by default
    return;
}
```

Fallthrough cases also stay attached:

```ts
switch (value) {
  case 1: // Fallthrough cases stay attached
  case 2:
    run();
}
```

### Configuration

| Option              | Type                           | Default   | Description                                                                 |
| ------------------- | ------------------------------ | --------- | --------------------------------------------------------------------------- |
| `maxCuddledLines`   | `number`                       | `2`       | Non-blank body line threshold distinguishing short cases from long cases.   |
| `longCase`          | `"always" \| "never" \| "any"` | `"never"` | Blank line policy before cases longer than `maxCuddledLines`.               |
| `shortCase`         | `"always" \| "never" \| "any"` | `"never"` | Blank line policy before short cases.                                       |
| `emptyCase`         | `"always" \| "never" \| "any"` | `"never"` | Blank line policy between consecutive empty fallthrough cases.              |
| `ignoreFallthrough` | `boolean`                      | `true`    | Preserve existing spacing for fallthrough cases without a terminating jump. |

---

## Shared statement grouping

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

Related statements are grouped using their structure and binding references. Small setup-and-use sequences remain compact; distinct processing phases are separated.

Direct accumulation loops stay attached to their return. Filtered loops retain a completion boundary. A returned closure stays attached to a single captured declaration, but is separated from a group containing multiple captured bindings.

Existing spacing is preserved between related guards and between an exact-property deletion branch and its restoration assignment.

---

## Test files and phase spacing

Test files (`*.test.*`, `*.spec.*`) often use blank lines to separate test phases (Arrange, Act, Assert).

The default `blank-lines` preset automatically applies test overrides (`testRules`) that disable compaction of declarations and expressions in test files. For exits in small helpers, it enables `compactShortBodies` with `shortBodySpacing: "any"`: compact operation-and-return bodies remain valid, while existing blank lines are preserved. Larger bodies retain normal exit separation. These overrides preserve intentional phase boundaries without inspecting test framework APIs.

When building a custom configuration without `extends`, import and apply `testRules` manually:

```ts
import { defineConfig } from "oxlint";
import { testFiles, testRules } from "oxlint-rules/blank-lines";

export default defineConfig({
  overrides: [
    {
      files: testFiles,
      rules: testRules,
    },
  ],
});
```
