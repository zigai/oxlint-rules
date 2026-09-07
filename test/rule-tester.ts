import { RuleTester as BaseRuleTester } from "oxlint/plugins-dev";
import type { Rule } from "@oxlint/plugins";
import { describe, it } from "vitest";

BaseRuleTester.describe = describe;
BaseRuleTester.it = it;

type TestableRule =
    | Rule
    | { readonly meta?: unknown; readonly create: (context: never) => unknown };

export class RuleTester extends BaseRuleTester {
    override run(
        ruleName: string,
        rule: TestableRule,
        tests: Parameters<BaseRuleTester["run"]>[2],
    ): void {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: BaseRuleTester executes any ESLint-compatible rule object at runtime.
        super.run(ruleName, rule as unknown as Rule, tests);
    }
}
