import { RuleTester } from "../../../test/rule-tester.ts";

import { noNeverAssertionsRule } from "./no-never-assertions.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("antislop/no-never-assertions", noNeverAssertionsRule, {
    valid: [
        `
            type Event = { readonly type: "open" } | { readonly type: "close" };
            function handle(event: Event): string {
                switch (event.type) {
                    case "open": return "opened";
                    case "close": return "closed";
                    default: {
                        const exhaustive: never = event;
                        return exhaustive;
                    }
                }
            }
        `,
    ],
    invalid: [
        {
            code: "const value = input as never;",
            errors: [{ messageId: "neverAssertion" }],
        },
        {
            code: "const value = <(never)>input;",
            errors: [{ messageId: "neverAssertion" }],
        },
    ],
});
