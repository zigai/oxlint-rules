import { RuleTester } from "../../../test/rule-tester.ts";

import { noChainedTypeAssertionsRule } from "./no-chained-type-assertions.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("antislop/no-chained-type-assertions", noChainedTypeAssertionsRule, {
    valid: [
        "const value = input as string;",
        "const value = input as const;",
        "const value = (input as string)?.length;",
    ],
    invalid: [
        {
            code: "const value = input as unknown as string;",
            errors: [{ messageId: "chained" }],
        },
        {
            code: "const value = <string><unknown>input;",
            errors: [{ messageId: "chained" }],
        },
    ],
});
