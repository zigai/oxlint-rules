import { defineRule, type ESTree } from "@oxlint/plugins";

type TypeAssertion = ESTree.TSAsExpression | ESTree.TSTypeAssertion;

function isNeverAssertion(node: TypeAssertion): boolean {
    let type = node.typeAnnotation;

    while (type.type === "TSParenthesizedType") {
        type = type.typeAnnotation;
    }

    return type.type === "TSNeverKeyword";
}

/** Disallow assertions to never, which erase the source type and can satisfy any target contract. */
export const noNeverAssertionsRule = defineRule({
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow TypeScript assertions to never; use control-flow exhaustiveness or an honest boundary adapter instead.",
        },
        schema: [],
        messages: {
            neverAssertion:
                "Do not assert this value to `never`. Preserve its source type and prove the target contract; use a `never` assignment for genuine exhaustiveness.",
        },
    },
    create(context) {
        const checkAssertion = (node: TypeAssertion) => {
            if (!isNeverAssertion(node)) return;
            context.report({ node, messageId: "neverAssertion" });
        };

        return {
            TSAsExpression: checkAssertion,
            TSTypeAssertion: checkAssertion,
        };
    },
});
