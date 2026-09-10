import { consumerUsesProviderReceiver } from "../references.ts";
import {
    compactStatementBoundary,
    statementGroupingDefaults,
    statementGroupingSchema,
    type StatementGroupingOptions,
} from "../related-statements.ts";
import { asNode, isSingleLine, nodeArray } from "../ast.ts";
import { getSourceCode, rangeOf } from "../spacing.ts";
import {
    createLayoutRule,
    pairwise,
    reportGapPolicy,
    statementContainerVisitors,
} from "../rule-utils.ts";
import { anyStatementSelectorMatches, type StatementSelector } from "../selectors.ts";
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

// A call that registers an independent behavior: one of its arguments is a
// block-bodied closure with its own body. Telemetry payloads and other
// expression-bodied closures stay attached to their step.
function registersBehavior(statement: AstNode): boolean {
    const expression = asNode(statement.expression);
    if (expression?.type !== "CallExpression") return false;
    return nodeArray(expression.arguments).some((argument) => {
        const callback = asNode(argument);
        if (callback?.type !== "ArrowFunctionExpression" && callback?.type !== "FunctionExpression")
            return false;
        return asNode(callback.body)?.type === "BlockStatement";
    });
}

function sameCallTarget(left: AstNode, right: AstNode, text: string): boolean {
    const caller = (statement: AstNode): string | null => {
        const expression = asNode(statement.expression);
        if (expression?.type !== "CallExpression") return null;
        const callee = asNode(expression.callee);
        if (callee === null) return null;
        const [start, end] = rangeOf(callee);
        return text.slice(start, end);
    };
    const callerLeft = caller(left);
    return callerLeft !== null && callerLeft === caller(right);
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

                const compact = compactStatementBoundary(
                    container,
                    statements,
                    statements.indexOf(current),
                    sourceCode,
                    options,
                );
                if ((previousSelected || currentSelected) && compact) {
                    policy = "never";
                }
                // An expression after a conditional starts a new phase, unless
                // it continues a compact single-line update pair, filters a
                // loop body, or belongs to a compact group the shared analysis
                // already claimed (such as trailing local bookkeeping).
                if (currentSelected && previous.type === "IfStatement" && policy !== "never") {
                    const consequent = asNode(previous.consequent);
                    const continuesUpdate =
                        asNode(previous.alternate) === null &&
                        consequent !== null &&
                        consequent.type === "ExpressionStatement" &&
                        isSingleLine(previous, sourceCode.text) &&
                        isSingleLine(current, sourceCode.text);
                    const continueFilter =
                        asNode(previous.alternate) === null &&
                        consequent?.type === "ContinueStatement";
                    if (!continuesUpdate && !continueFilter) {
                        policy = "always";
                    }
                }
                // Independent registrations separate: consecutive calls to the
                // same target whose closures each have their own body are
                // distinct behaviors. A setup step attached to its handler
                // stays compact.
                if (
                    previousSelected &&
                    currentSelected &&
                    policy !== "never" &&
                    registersBehavior(previous) &&
                    registersBehavior(current) &&
                    sameCallTarget(previous, current, sourceCode.text)
                ) {
                    policy = "always";
                }
                // A substantial call step completes before the next call begins:
                // consecutive calls stay compact only while the first fits on one
                // line or the next call consumes the previous call's receiver.
                if (
                    previousSelected &&
                    currentSelected &&
                    previousKind === "call" &&
                    currentKind === "call" &&
                    policy !== "never" &&
                    !isSingleLine(previous, sourceCode.text) &&
                    !consumerUsesProviderReceiver(previous, current, sourceCode)
                ) {
                    policy = "always";
                }
                reportGapPolicy(context, previous, current, policy, {
                    always: "expectedBlank",
                    never: "unexpectedBlank",
                });
            }
        });
    },
);
