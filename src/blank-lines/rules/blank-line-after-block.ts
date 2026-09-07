import {
    compactStatementBoundary,
    restorationBoundary,
    statementGroupingDefaults,
    statementGroupingSchema,
    type StatementGroupingOptions,
} from "../related-statements.ts";
import { isSingleLine } from "../ast.ts";
import {
    createLayoutRule,
    pairwise,
    reportGapPolicy,
    statementContainerVisitors,
} from "../rule-utils.ts";
import { anyStatementSelectorMatches, type StatementSelector } from "../selectors.ts";
import { getSourceCode } from "../spacing.ts";
import type { RuleContext } from "../types.ts";

export interface BlankLineAfterBlockOptions extends StatementGroupingOptions {
    readonly statements?: readonly StatementSelector[];
    readonly exceptBefore?: readonly StatementSelector[];
    readonly ignoreSingleLine?: boolean;
}

type Options = readonly [BlankLineAfterBlockOptions?];

const DEFAULTS: Required<BlankLineAfterBlockOptions> = {
    ...statementGroupingDefaults,
    statements: ["if", "for", "while", "do", "switch", "try", "block", "with"],
    exceptBefore: ["break", "continue"],
    ignoreSingleLine: true,
};

export default createLayoutRule<Options>(
    "Require a blank line after configurable block-like statements.",
    [
        {
            type: "object",
            additionalProperties: false,
            properties: {
                ...statementGroupingSchema,
                statements: { type: "array", minItems: 1, items: { type: "string" } },
                exceptBefore: { type: "array", items: { type: "string" } },
                ignoreSingleLine: { type: "boolean" },
            },
        },
    ],
    {
        expectedBlank: "Expected a blank line after this block-like statement.",
        unexpectedBlank: "Keep related conditional updates together.",
    },
    (context: RuleContext<Options>) => {
        const options = { ...DEFAULTS, ...context.options[0] };
        const sourceCode = getSourceCode(context);

        return statementContainerVisitors((container, statements) => {
            for (const [previous, current] of pairwise(statements)) {
                if (
                    options.compactConditionalUpdates &&
                    restorationBoundary(previous, current, sourceCode)
                )
                    continue;
                const compact = compactStatementBoundary(
                    container,
                    statements,
                    statements.indexOf(current),
                    sourceCode,
                    options,
                );
                if (
                    !anyStatementSelectorMatches(previous, options.statements, sourceCode.text) ||
                    (options.ignoreSingleLine &&
                        !compact &&
                        isSingleLine(previous, sourceCode.text)) ||
                    (options.exceptBefore.length > 0 &&
                        anyStatementSelectorMatches(current, options.exceptBefore, sourceCode.text))
                ) {
                    continue;
                }
                // Related conditionals can form one group or intentional subphases.
                // Accept either layout rather than flattening an existing boundary.
                if (compact && previous.type === "IfStatement" && current.type === "IfStatement")
                    continue;
                reportGapPolicy(context, previous, current, compact ? "never" : "always", {
                    always: "expectedBlank",
                    never: "unexpectedBlank",
                });
            }
        });
    },
);
