import {
    compactStatementBoundary,
    isCompactExitPredecessor,
    statementGroupingDefaults,
    statementGroupingSchema,
    type StatementGroupingOptions,
} from "../related-statements.ts";
import { lineSpan } from "../ast.ts";
import {
    createLayoutRule,
    pairwise,
    reportGapPolicy,
    statementContainerVisitors,
} from "../rule-utils.ts";
import {
    anyStatementSelectorMatches,
    statementMatches,
    type StatementSelector,
} from "../selectors.ts";
import { getSourceCode } from "../spacing.ts";
import type { AstNode, RuleContext } from "../types.ts";

export type ExitKind = "return" | "throw" | "break" | "continue";

export interface BlankLineBeforeExitOptions extends StatementGroupingOptions {
    readonly exits?: readonly ExitKind[];
    readonly minContainerLines?: number;
    readonly exceptAfter?: readonly StatementSelector[];
    readonly compactAfterSingleLine?: boolean;
    readonly compactJumpsAfterBlock?: boolean;
    readonly shortBodySpacing?: "never" | "any";
}

type Options = readonly [BlankLineBeforeExitOptions?];

const DEFAULTS: Required<BlankLineBeforeExitOptions> = {
    ...statementGroupingDefaults,
    exits: ["return", "throw", "break", "continue"],
    minContainerLines: 3,
    exceptAfter: ["if"],
    compactAfterSingleLine: true,
    compactJumpsAfterBlock: true,
    shortBodySpacing: "never",
};

function isConfiguredExit(node: AstNode, exits: readonly ExitKind[], sourceText: string): boolean {
    return exits.some((exit) => statementMatches(node, exit, sourceText));
}

export default createLayoutRule<Options>(
    "Require a blank line before return, throw, break, and continue in non-trivial bodies.",
    [
        {
            type: "object",
            additionalProperties: false,
            properties: {
                ...statementGroupingSchema,
                exits: {
                    type: "array",
                    uniqueItems: true,
                    items: { enum: ["return", "throw", "break", "continue"] },
                },
                minContainerLines: { type: "integer", minimum: 0 },
                compactAfterSingleLine: { type: "boolean" },
                compactJumpsAfterBlock: { type: "boolean" },
                shortBodySpacing: { enum: ["never", "any"] },
                exceptAfter: {
                    type: "array",
                    items: { type: "string" },
                },
            },
        },
    ],
    {
        expectedBlank: "Expected a blank line before this exit statement.",
        unexpectedBlank: "Keep this exit with the preceding related operation or short body.",
        unexpectedJumpBlank:
            "Keep this break or continue attached to the preceding control-flow block.",
    },
    (context: RuleContext<Options>) => {
        const options = { ...DEFAULTS, ...context.options[0] };
        const sourceCode = getSourceCode(context);

        return statementContainerVisitors((container, statements) => {
            for (const [previous, current] of pairwise(statements)) {
                if (!isConfiguredExit(current, options.exits, sourceCode.text)) {
                    continue;
                }
                if (
                    options.compactShortBodies &&
                    options.shortBodySpacing === "any" &&
                    compactStatementBoundary(
                        container,
                        statements,
                        statements.indexOf(current),
                        sourceCode,
                        { compactShortBodies: true },
                    )
                ) {
                    continue;
                }
                if (
                    compactStatementBoundary(
                        container,
                        statements,
                        statements.indexOf(current),
                        sourceCode,
                        options,
                    )
                ) {
                    reportGapPolicy(context, previous, current, "never", {
                        always: "expectedBlank",
                        never: "unexpectedBlank",
                    });
                    continue;
                }
                if (
                    options.compactJumpsAfterBlock &&
                    (current.type === "BreakStatement" || current.type === "ContinueStatement") &&
                    anyStatementSelectorMatches(
                        previous,
                        ["if", "for", "while", "do", "switch", "try", "block", "with"],
                        sourceCode.text,
                    )
                ) {
                    reportGapPolicy(context, previous, current, "never", {
                        always: "expectedBlank",
                        never: "unexpectedJumpBlank",
                    });
                    continue;
                }
                if (
                    options.compactAfterSingleLine &&
                    isCompactExitPredecessor(previous, current, sourceCode)
                ) {
                    reportGapPolicy(context, previous, current, "never", {
                        always: "expectedBlank",
                        never: "unexpectedBlank",
                    });
                    continue;
                }
                if (lineSpan(container, sourceCode.text) < options.minContainerLines) continue;
                if (
                    options.exceptAfter.length > 0 &&
                    anyStatementSelectorMatches(previous, options.exceptAfter, sourceCode.text)
                ) {
                    continue;
                }
                reportGapPolicy(context, previous, current, "always", {
                    always: "expectedBlank",
                    never: "expectedBlank",
                });
            }
        });
    },
);
