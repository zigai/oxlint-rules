# Oxlint Rules

Reusable Oxlint rules for TypeScript projects.

## Install

```sh
npm install --save-dev oxlint oxlint-rules
```

## Usage

Create `oxlint.config.ts` and extend the shared config to enable every rule:

```ts
import { defineConfig } from "oxlint";
import antislop from "oxlint-rules/config";

export default defineConfig({
  extends: [antislop],
});
```

To enable only specific rules, register the plugin directly:

```ts
import { defineConfig } from "oxlint";

export default defineConfig({
  jsPlugins: ["oxlint-rules"],
  rules: {
    "antislop/no-never-assertions": "error",
    "antislop/no-unknown-parameters": "error",
  },
});
```

Rules from the shared config can be disabled or configured normally:

```ts
import { defineConfig } from "oxlint";
import antislop from "oxlint-rules/config";

export default defineConfig({
  extends: [antislop],
  rules: {
    "antislop/no-module-mocking": "off",
    "antislop/no-runtime-typeof": ["error", { allowInTypeGuards: true }],
  },
});
```

Effect projects can use the Effect config instead:

```ts
import { defineConfig } from "oxlint";
import antislop from "oxlint-rules/config/effect";

export default defineConfig({
  extends: [antislop],
});
```

See the [rule reference](docs/rules.md) for available rules and options.

The `antislop` rules are derived from `dmmulroy/anti-slop`. Their source and
license are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Development

```sh
npm ci
just check
just coverage
```

## License

[MIT](LICENSE)
