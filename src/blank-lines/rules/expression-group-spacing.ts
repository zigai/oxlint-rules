import {
    compactStatementBoundary,
    deferredGuardBoundary,
    statementGroupingDefaults,
    statementGroupingSchema,
    type StatementGroupingOptions,
} from "../related-statements.ts";
import { asNode } from "../ast.ts";
import {
    createLayoutRule,
    pairwise,
    reportGapPolicy,
    statementContainerVisitors,
} from "../rule-utils.ts";
import { anyStatementSelectorMatches, type StatementSelector } from "../selectors.ts";
import { getSourceCode } from "../spacing.ts";
import type { AstNode, BlankLinePolicy, RuleContext } from "../types.ts";

export type ExpressionKind =
    | "assignment"
    | "await"
    | "call"
    | "new"
    | "tagged-template"
    | "update"
    | "yield"
    | "other";

export interface ExpressionGroupSpacingOptions extends StatementGroupingOptions {
    readonly kinds?: readonly ExpressionKind[];
    readonly groupByKind?: boolean;
    readonly withinGroup?: BlankLinePolicy;
    readonly betweenGroups?: BlankLinePolicy;
    readonly beforeGroup?: BlankLinePolicy;
    readonly afterGroup?: BlankLinePolicy;
    readonly exceptBefore?: readonly StatementSelector[];
    readonly allowAssignmentBeforeControlFlow?: boolean;
}

type Options = readonly [ExpressionGroupSpacingOptions?];

const DEFAULTS: Required<ExpressionGroupSpacingOptions> = {
    ...statementGroupingDefaults,
    kinds: ["assignment", "await", "call", "new", "tagged-template", "update", "yield"],
    groupByKind: false,
    withinGroup: "any",
    betweenGroups: "always",
    beforeGroup: "any",
    afterGroup: "always",
    exceptBefore: ["return", "throw", "break", "continue"],
    allowAssignmentBeforeControlFlow: true,
};

function expressionNodeKind(expression: AstNode): ExpressionKind {
    if (expression.type === "UnaryExpression") {
        if (expression.operator === "delete") return "assignment";
        if (expression.operator === "void") {
            const argument = asNode(expression.argument);
            return argument === null ? "other" : expressionNodeKind(argument);
        }
    }
    if (expression.type === "ChainExpression") {
        const inner = asNode(expression.expression);
        return inner === null ? "other" : expressionNodeKind(inner);
    }

    switch (expression.type) {
        case "AssignmentExpression":
            return "assignment";
        case "AwaitExpression":
            return "await";
        case "CallExpression":
        case "OptionalCallExpression":
            return "call";
        case "NewExpression":
            return "new";
        case "TaggedTemplateExpression":
            return "tagged-template";
        case "UpdateExpression":
            return "update";
        case "YieldExpression":
            return "yield";
        default:
            return "other";
    }
}

function expressionKind(statement: AstNode): ExpressionKind | null {
    if (statement.type !== "ExpressionStatement" || typeof statement.directive === "string") {
        return null;
    }
    const expression = asNode(statement.expression);
    return expression === null ? null : expressionNodeKind(expression);
}

export default createLayoutRule<Options>(
    "Group selected expression statements and separate the group from surrounding statement kinds.",
    [
        {
            type: "object",
            additionalProperties: false,
            properties: {
                ...statementGroupingSchema,
                kinds: {
                    type: "array",
                    uniqueItems: true,
                    items: {
                        enum: [
                            "assignment",
                            "await",
                            "call",
                            "new",
                            "tagged-template",
                            "update",
                            "yield",
                            "other",
                        ],
                    },
                },
                groupByKind: { type: "boolean" },
                withinGroup: { enum: ["always", "never", "any"] },
                betweenGroups: { enum: ["always", "never", "any"] },
                beforeGroup: { enum: ["always", "never", "any"] },
                afterGroup: { enum: ["always", "never", "any"] },
                exceptBefore: { type: "array", items: { type: "string" } },
                allowAssignmentBeforeControlFlow: { type: "boolean" },
            },
        },
    ],
    {
        expectedBlank: "Expected a blank line at this expression-group boundary.",
        unexpectedBlank: "Unexpected blank line inside this expression group.",
    },
    (context: RuleContext<Options>) => {
        const options = { ...DEFAULTS, ...context.options[0] };
        const sourceCode = getSourceCode(context);
        return statementContainerVisitors((container, statements) => {
            for (const [previous, current] of pairwise(statements)) {
                const previousKind = expressionKind(previous);
                const currentKind = expressionKind(current);
                if (
                    options.compactRelatedControlFlow &&
                    deferredGuardBoundary(statements, statements.indexOf(current), sourceCode)
                )
                    continue;
                const previousSelected =
                    previousKind !== null && options.kinds.includes(previousKind);
                const currentSelected = currentKind !== null && options.kinds.includes(currentKind);
                let policy: BlankLinePolicy = "any";

                if (previousSelected && currentSelected) {
                    policy =
                        options.groupByKind && previousKind !== currentKind
                            ? options.betweenGroups
                            : options.withinGroup;
                } else if (previousSelected) {
                    const excluded =
                        options.exceptBefore.length > 0 &&
                        anyStatementSelectorMatches(current, options.exceptBefore, sourceCode.text);
                    const assignmentControlFlow =
                        options.allowAssignmentBeforeControlFlow &&
                        (previousKind === "assignment" || previousKind === "update") &&
                        anyStatementSelectorMatches(
                            current,
                            ["if", "for", "while", "do", "switch"],
                            sourceCode.text,
                        );
                    policy = excluded || assignmentControlFlow ? "any" : options.afterGroup;
                } else if (currentSelected) {
                    policy = options.beforeGroup;
                }

                if (
                    (previousSelected || currentSelected) &&
                    compactStatementBoundary(
                        container,
                        statements,
                        statements.indexOf(current),
                        sourceCode,
                        options,
                    )
                ) {
                    policy = "never";
                }

                reportGapPolicy(context, previous, current, policy, {
                    always: "expectedBlank",
                    never: "unexpectedBlank",
                });
            }
        });
    },
);
