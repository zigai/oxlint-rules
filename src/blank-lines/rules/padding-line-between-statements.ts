import {
    pairwise,
    createLayoutRule,
    reportGapPolicy,
    statementContainerVisitors,
} from "../rule-utils.ts";
import { anyStatementSelectorMatches, type StatementSelector } from "../selectors.ts";
import { getSourceCode } from "../spacing.ts";
import type { AstNode, BlankLinePolicy, RuleContext } from "../types.ts";

export interface PaddingPair {
    readonly blankLine: BlankLinePolicy;
    readonly prev: StatementSelector | readonly StatementSelector[];
    readonly next: StatementSelector | readonly StatementSelector[];
}

export interface PaddingLineBetweenStatementsOptions {
    readonly pairs?: readonly PaddingPair[];
}

type Options = readonly [PaddingLineBetweenStatementsOptions?];

const SELECTORS = [
    "*",
    "block",
    "block-like",
    "break",
    "class",
    "const",
    "continue",
    "debugger",
    "directive",
    "do",
    "empty",
    "enum",
    "export",
    "expression",
    "for",
    "function",
    "if",
    "import",
    "interface",
    "labeled",
    "let",
    "multiline",
    "namespace",
    "return",
    "singleline",
    "switch",
    "throw",
    "try",
    "type",
    "var",
    "while",
    "with",
] as const;

function matchingPolicy(
    pairs: readonly PaddingPair[],
    previous: AstNode,
    next: AstNode,
    sourceText: string,
): BlankLinePolicy {
    let policy: BlankLinePolicy = "any";
    for (const pair of pairs) {
        if (
            anyStatementSelectorMatches(previous, pair.prev, sourceText) &&
            anyStatementSelectorMatches(next, pair.next, sourceText)
        ) {
            policy = pair.blankLine;
        }
    }
    return policy;
}

export default createLayoutRule<Options>(
    "Require or disallow blank lines between configurable TypeScript statement kinds.",
    [
        {
            type: "object",
            additionalProperties: false,
            properties: {
                pairs: {
                    type: "array",
                    items: {
                        type: "object",
                        required: ["blankLine", "prev", "next"],
                        additionalProperties: false,
                        properties: {
                            blankLine: { enum: ["always", "never", "any"] },
                            prev: {
                                anyOf: [
                                    { enum: SELECTORS },
                                    { type: "array", minItems: 1, items: { enum: SELECTORS } },
                                ],
                            },
                            next: {
                                anyOf: [
                                    { enum: SELECTORS },
                                    { type: "array", minItems: 1, items: { enum: SELECTORS } },
                                ],
                            },
                        },
                    },
                },
            },
        },
    ],
    {
        expectedBlank: "Expected a blank line between these statements.",
        unexpectedBlank: "Unexpected blank line between these statements.",
    },
    (context: RuleContext<Options>) => {
        const pairs = context.options[0]?.pairs ?? [];
        const sourceCode = getSourceCode(context);
        return statementContainerVisitors((_container, statements) => {
            for (const [previous, next] of pairwise(statements)) {
                const policy = matchingPolicy(pairs, previous, next, sourceCode.text);
                reportGapPolicy(context, previous, next, policy, {
                    always: "expectedBlank",
                    never: "unexpectedBlank",
                });
            }
        });
    },
);
