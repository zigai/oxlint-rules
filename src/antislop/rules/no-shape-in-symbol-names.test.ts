import { RuleTester } from "../../../test/rule-tester.ts";

import { noForbiddenTermInSymbolNamesRule } from "./no-shape-in-symbol-names.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });

tester.run("antislop/no-shape-in-symbol-names", noForbiddenTermInSymbolNamesRule, {
    valid: ["const schema = {};", "type Payload = { readonly value: string };"],
    invalid: [
        {
            code: "const responseShape = {};",
            errors: [{ messageId: "forbiddenSymbolName" }],
        },
        {
            code: "type ShapeFactory = () => object;",
            errors: [{ messageId: "forbiddenSymbolName" }],
        },
        {
            code: "const view = <ShapePanel />;",
            errors: [{ messageId: "forbiddenSymbolName" }],
        },
    ],
});
