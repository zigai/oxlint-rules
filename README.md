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

Effect projects can use the Effect config instead:

```ts
import { defineConfig } from "oxlint";
import antislop from "oxlint-rules/config/effect";

export default defineConfig({
  extends: [antislop],
});
```

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
