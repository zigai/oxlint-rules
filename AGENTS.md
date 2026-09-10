# AGENTS.md

Guidance for AI agents and contributors authoring, updating, or documenting rules in `oxlint-rules`.

---

## Adding a New Rule

Every new rule added to this repository must be implemented, tested, documented, linked in `README.md`, and verified through `npm run doc:check`.

### 1. Implementation & Tests

1. **Source file:** `src/<category>/rules/<rule-name>.ts`
   - Define using `defineRule` from `@oxlint/plugins`.
2. **Unit tests:** `src/<category>/rules/<rule-name>.test.ts`
   - Test using `RuleTester` from `test/rule-tester.ts`.
   - Cover all valid cases and invalid edge cases.
3. **Export:** Register the rule in `src/<category>/rules.ts`:
   - Add to `antislopRules` or `blankLinesRules`.
4. **Presets:** If the rule belongs in a default preset, update:
   - `src/config/` (for antislop / effect presets)
   - `src/blank-lines/recommended.ts` (for blank-lines recommended rules)

---

### 2. Rule Documentation (`docs/<category>.md`)

Document the rule in its category file (`docs/antislop.md` or `docs/blanklines.md`):

#### Structure

````markdown
## <plugin>/<rule-name>

### What it does

One or two sentences explaining what the rule checks and enforces.

### Why is this bad?

Concrete technical explanation of why the pattern is problematic (e.g. type unsoundness, runtime failure, memory overhead, architectural coupling, or visual clutter).

### Examples

Examples of **incorrect** code for this rule:

```ts
// Minimal snippet illustrating the violation
```

Examples of **correct** code for this rule:

```ts
// The corresponding code demonstrating the correct pattern
```
````

#### Documentation Rules & Conventions

- **No category badges:** Do not add standalone category lines like `Style` or `Restriction` under the rule heading. The heading immediately leads into `### What it does`.
- **Inline comments only:** All explanatory comments within code examples must be **inline at the end of statement lines** (e.g. `const a = 1; // Inline note`). Never place comments on their own standalone lines, especially in blank-line examples where standalone comments disrupt whitespace analysis.
- **Separate blocks for variations:** The primary `Examples of **correct** code` block should demonstrate the direct fix for the `incorrect` example. Any additional allowed variations (such as grouping exceptions or compact forms) should be placed in their own separate, clearly labeled code blocks.
- **Formatter protection:** For whitespace or formatting rules where formatters (`oxfmt`) would strip the intentional violation (such as consecutive blank lines or block boundary padding), prefix the incorrect code block with `<!-- prettier-ignore -->`.
- **Configuration table:** If (and only if) the rule accepts options, document them using a compact Markdown table:

  ```markdown
  ### Configuration

  | Option     | Type      | Default | Description                    |
  | ---------- | --------- | ------- | ------------------------------ |
  | `myOption` | `boolean` | `false` | Explains what the option does. |
  ```

- **No `### How to use` JSON blocks:** Do not add repetitive `### How to use` JSON blocks. General Oxlint rule configuration syntax is already documented in `README.md`.

---

### 3. Update `README.md` Rules Table

Add the new rule to the corresponding table under `## Rules` in `README.md`:

```markdown
| [`category/rule-name`](docs/<category>.md#<anchor>) | One-line description. | Autofix (Yes/No) |
```

- **Anchor formatting:** The link anchor must match GitHub's heading slug:
  - Lowercase
  - Remove slashes and non-alphanumerics except hyphens
  - Example: `antislop/no-chained-type-assertions` &rarr; `docs/antislop.md#antislopno-chained-type-assertions`
  - Example: `blank-lines/blank-line-after-block` &rarr; `docs/blanklines.md#blank-linesblank-line-after-block`
- **Autofix column:** Set to `Yes` if the rule provides autofixes (`meta.fixable !== undefined`), otherwise `No`.

---

### 4. Verification

Run the full project verification suite before completing any changes:

```sh
npm run format       # Formats code and markdown files with oxfmt
npm run doc:check    # Verifies all documentation examples against real rules
npm run check        # Runs formatting, linting, typecheck, tests, package check, consumer check, and doc:check
```

`npm run doc:check` (`scripts/check-doc-examples.ts`) automatically validates that:

1. Every exported rule in the package is documented in `docs/*.md`.
2. Every documented incorrect example triggers $\ge 1$ diagnostic for that rule.
3. Every documented correct example produces $0$ diagnostics for that rule.
