import { bindingsFeedRegions, mutationFeedsRegions } from "../references.ts";
import {
    compactStatementBoundary,
    statementGroupingDefaults,
    statementGroupingSchema,
    type StatementGroupingOptions,
} from "../related-statements.ts";
import {
    asNode,
    caseConsequent,
    isSingleLine,
    nodeArray,
    statementBody,
    unwrapExport,
} from "../ast.ts";
import {
    createLayoutRule,
    editFix,
    pairwise,
    pureMultilineGap,
    statementContainerVisitors,
} from "../rule-utils.ts";
import { editForPolicy, getSourceCode } from "../spacing.ts";
import type { AstNode, RuleContext, SourceCode } from "../types.ts";

export type ControlFlowKind = "if" | "for" | "while" | "do" | "switch";
export type BodyUsage = "never" | "first" | "any";

export interface ControlFlowCuddlingOptions extends StatementGroupingOptions {
    readonly controlFlow?: readonly ControlFlowKind[];
    readonly maxCuddledStatements?: number;
    readonly includeAssignments?: boolean;
    readonly allowConditionUsage?: boolean;
    readonly allowBodyUsage?: BodyUsage;
    readonly requireAllBindings?: boolean;
    readonly allowConsecutiveSingleLineIf?: boolean;
    readonly compactRelatedSetup?: boolean;
}

type Options = readonly [ControlFlowCuddlingOptions?];

const DEFAULTS: Required<ControlFlowCuddlingOptions> = {
    ...statementGroupingDefaults,
    controlFlow: ["if", "for", "while", "do", "switch"],
    maxCuddledStatements: 3,
    includeAssignments: true,
    allowConditionUsage: true,
    allowBodyUsage: "any",
    requireAllBindings: true,
    allowConsecutiveSingleLineIf: true,
    compactRelatedSetup: true,
};

function controlKind(node: AstNode): ControlFlowKind | null {
    switch (node.type) {
        case "IfStatement":
            return "if";
        case "ForStatement":
        case "ForInStatement":
        case "ForOfStatement":
            return "for";
        case "WhileStatement":
            return "while";
        case "DoWhileStatement":
            return "do";
        case "SwitchStatement":
            return "switch";
        default:
            return null;
    }
}

function headerNodes(node: AstNode): readonly AstNode[] {
    switch (node.type) {
        case "IfStatement":
        case "WhileStatement":
        case "DoWhileStatement":
            return [asNode(node.test)].filter((item): item is AstNode => item !== null);
        case "ForStatement":
            return [asNode(node.init), asNode(node.test), asNode(node.update)].filter(
                (item): item is AstNode => item !== null,
            );
        case "ForInStatement":
        case "ForOfStatement":
            return [asNode(node.right)].filter((item): item is AstNode => item !== null);
        case "SwitchStatement":
            return [asNode(node.discriminant)].filter((item): item is AstNode => item !== null);
        default:
            return [];
    }
}

function firstStatements(value: unknown): readonly AstNode[] {
    const node = asNode(value);
    if (node === null) {
        return [];
    }
    if (node.type === "BlockStatement") {
        const first = statementBody(node)[0];
        return first === undefined ? [] : [first];
    }
    return [node];
}

function bodyNodes(node: AstNode, mode: BodyUsage): readonly AstNode[] {
    if (mode === "never") {
        return [];
    }

    if (node.type === "IfStatement") {
        const branches = [node.consequent, node.alternate];
        return mode === "first"
            ? branches.flatMap(firstStatements)
            : branches.map(asNode).filter((item): item is AstNode => item !== null);
    }

    if (node.type === "SwitchStatement") {
        const cases = nodeArray(node.cases);
        if (mode === "first") {
            return cases.flatMap((caseNode) => {
                const first = caseConsequent(caseNode)[0];
                return first === undefined ? [] : [first];
            });
        }
        return cases;
    }

    const body = asNode(node.body);
    if (body === null) {
        return [];
    }
    return mode === "first" ? firstStatements(body) : [body];
}

function isMultilineCallbackDefinition(node: AstNode, sourceCode: SourceCode): boolean {
    const declaration = unwrapExport(node);
    if (declaration.type !== "VariableDeclaration") return false;
    const declarators = nodeArray(declaration.declarations);
    if (declarators.length !== 1) return false;
    const initializer = asNode(declarators[0]?.init);
    return (
        initializer?.type === "ArrowFunctionExpression" &&
        !isSingleLine(initializer, sourceCode.text)
    );
}

function bindingsAreRelated(
    candidate: AstNode,
    control: AstNode,
    options: Required<ControlFlowCuddlingOptions>,
    sourceCode: SourceCode,
): boolean {
    if (candidate.type === "VariableDeclaration") {
        const declarations = nodeArray(candidate.declarations);
        const aliases =
            declarations.length > 0 &&
            declarations.every((node) => {
                let initializer = asNode(node.init);
                while (
                    initializer?.type === "ParenthesizedExpression" ||
                    initializer?.type === "ChainExpression" ||
                    initializer?.type === "TSAsExpression" ||
                    initializer?.type === "TSInstantiationExpression" ||
                    initializer?.type === "TSNonNullExpression" ||
                    initializer?.type === "TSSatisfiesExpression" ||
                    initializer?.type === "TSTypeAssertion"
                ) {
                    initializer = asNode(initializer.expression);
                }
                return initializer?.type === "Identifier";
            });
        const aggregateChoice =
            !isSingleLine(candidate, sourceCode.text) &&
            declarations.some((node) => {
                const initializer = asNode(node.init);
                return (
                    initializer?.type === "ConditionalExpression" &&
                    asNode(initializer.consequent)?.type === "ObjectExpression" &&
                    asNode(initializer.alternate)?.type === "ObjectExpression"
                );
            });
        if (
            aggregateChoice ||
            (aliases &&
                !bindingsFeedRegions(
                    candidate,
                    headerNodes(control),
                    sourceCode,
                    false,
                    options.requireAllBindings,
                ))
        )
            return false;
    }
    const regions = [
        ...(options.allowConditionUsage ? headerNodes(control) : []),
        ...bodyNodes(control, options.allowBodyUsage),
    ];
    return (
        bindingsFeedRegions(
            candidate,
            regions,
            sourceCode,
            options.includeAssignments,
            options.requireAllBindings,
            "either",
        ) ||
        (options.includeAssignments &&
            mutationFeedsRegions(
                candidate,
                regions,
                sourceCode,
                asNode(candidate.expression)?.type === "AssignmentExpression" &&
                    [
                        "FunctionDeclaration",
                        "FunctionExpression",
                        "ArrowFunctionExpression",
                    ].includes(asNode(asNode(candidate.parent)?.parent)?.type ?? ""),
            ))
    );
}

export default createLayoutRule<Options>(
    "Permit control-flow cuddling only when nearby variable declarations or assignments feed that control flow.",
    [
        {
            type: "object",
            additionalProperties: false,
            properties: {
                ...statementGroupingSchema,
                controlFlow: {
                    type: "array",
                    uniqueItems: true,
                    items: { enum: ["if", "for", "while", "do", "switch"] },
                },
                maxCuddledStatements: { type: "integer", minimum: 0 },
                includeAssignments: { type: "boolean" },
                allowConditionUsage: { type: "boolean" },
                allowBodyUsage: { enum: ["never", "first", "any"] },
                requireAllBindings: { type: "boolean" },
                allowConsecutiveSingleLineIf: { type: "boolean" },
                compactRelatedSetup: { type: "boolean" },
            },
        },
    ],
    {
        related: "Keep related setup and conditional updates together.",
        unrelated:
            "Insert a blank line before this control-flow statement; it is not preceded by a related declaration or assignment.",
        tooMany:
            "Insert a blank line before this control-flow statement; at most {{maximum}} statement(s) may cuddle with it.",
        callbackPhase:
            "Insert a blank line before this traversal; the callback defined above is a separate preparation phase.",
    },
    (context: RuleContext<Options>) => {
        const options: Required<ControlFlowCuddlingOptions> = {
            ...DEFAULTS,
            ...context.options[0],
        };
        const sourceCode = getSourceCode(context);

        return statementContainerVisitors((container, statements) => {
            for (const [previous, current] of pairwise(statements)) {
                const kind = controlKind(current);
                if (kind === null || !options.controlFlow.includes(kind)) {
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
                    if (previous.type === "IfStatement" && current.type === "IfStatement") continue;
                    const edit = editForPolicy(sourceCode, previous, current, "never");
                    if (edit !== null)
                        context.report({ node: current, messageId: "related", fix: editFix(edit) });
                    continue;
                }
                if (
                    options.allowConsecutiveSingleLineIf &&
                    kind === "if" &&
                    controlKind(previous) === "if" &&
                    isSingleLine(previous, sourceCode.text) &&
                    isSingleLine(current, sourceCode.text)
                ) {
                    continue;
                }

                const immediateGap = pureMultilineGap(context, previous, current);
                if (immediateGap === null) {
                    continue;
                }

                const currentIndex = statements.indexOf(current);
                const cuddled: AstNode[] = [];
                for (let index = currentIndex - 1; index >= 0; index -= 1) {
                    const candidate = statements[index];
                    if (candidate === undefined) {
                        break;
                    }
                    if (index < currentIndex - 1) {
                        const next = statements[index + 1];
                        if (next === undefined) {
                            break;
                        }
                        const gap = pureMultilineGap(context, candidate, next);
                        if (gap === null) {
                            break;
                        }
                    }
                    if (!bindingsAreRelated(candidate, current, options, sourceCode)) break;
                    cuddled.unshift(candidate);
                }

                const tooMany = cuddled.length > options.maxCuddledStatements;
                const related = cuddled.length > 0;

                const compact =
                    options.compactRelatedSetup &&
                    !tooMany &&
                    related &&
                    cuddled.every(
                        (candidate) =>
                            isSingleLine(candidate, sourceCode.text) &&
                            options.allowConditionUsage &&
                            (candidate !== previous ||
                                bindingsFeedRegions(
                                    candidate,
                                    headerNodes(current),
                                    sourceCode,
                                    options.includeAssignments,
                                    options.requireAllBindings,
                                    "either",
                                ) ||
                                (options.includeAssignments &&
                                    mutationFeedsRegions(
                                        candidate,
                                        headerNodes(current),
                                        sourceCode,
                                    ))),
                    );
                if (
                    (kind === "for" || kind === "while") &&
                    isMultilineCallbackDefinition(previous, sourceCode) &&
                    bindingsAreRelated(previous, current, options, sourceCode)
                ) {
                    const edit = editForPolicy(sourceCode, previous, current, "always");
                    if (edit !== null)
                        context.report({
                            node: current,
                            messageId: "callbackPhase",
                            fix: editFix(edit),
                        });
                    continue;
                }
                if (!tooMany && related && !compact) continue;
                const edit = editForPolicy(
                    sourceCode,
                    previous,
                    current,
                    compact ? "never" : "always",
                );
                if (edit === null) {
                    continue;
                }
                context.report({
                    node: current,
                    messageId: compact ? "related" : tooMany ? "tooMany" : "unrelated",
                    ...(tooMany ? { data: { maximum: options.maxCuddledStatements } } : {}),
                    fix: editFix(edit),
                });
            }
        });
    },
);
