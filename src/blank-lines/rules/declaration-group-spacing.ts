import {
    compactStatementBoundary,
    initializesInTry,
    isSingleLineVariable,
    returnedClosureBoundary,
    usesDeclaredBindings,
    withinNodeBudget,
    statementGroupingDefaults,
    statementGroupingSchema,
    type StatementGroupingOptions,
} from "../related-statements.ts";
import {
    areSameFunctionOverloads,
    asNode,
    isSingleLine,
    nodeArray,
    unwrapExport,
    walkAst,
} from "../ast.ts";
import { hasDeferredExecution, resolveBinding } from "../references.ts";
import {
    createLayoutRule,
    pairwise,
    reportGapPolicy,
    statementContainerVisitors,
} from "../rule-utils.ts";
import {
    anyStatementSelectorMatches,
    declarationKind,
    type DeclarationKind,
} from "../selectors.ts";
import { getSourceCode, rangeOf } from "../spacing.ts";
import type { AstNode, BlankLinePolicy, RuleContext, SourceCode } from "../types.ts";

export interface DeclarationGroupSpacingOptions extends StatementGroupingOptions {
    readonly groups?: readonly (readonly DeclarationKind[])[];
    readonly withinGroup?: BlankLinePolicy;
    readonly betweenGroups?: BlankLinePolicy;
    readonly beforeGroup?: BlankLinePolicy;
    readonly afterGroup?: BlankLinePolicy;
    readonly unlisted?: "ignore" | "own-group";
    readonly allowBeforeControlFlow?: boolean;
    readonly compactSingleLineDeclarations?: boolean;
    /** Separate multiline type and interface declarations. */
    readonly separateMultilineDeclarations?: boolean;
    readonly compactRelatedUse?: boolean;
}

type Options = readonly [DeclarationGroupSpacingOptions?];

const DEFAULTS: Required<DeclarationGroupSpacingOptions> = {
    ...statementGroupingDefaults,
    groups: [
        ["import"],
        ["type", "interface"],
        ["enum", "namespace"],
        ["const", "let", "var"],
        ["function"],
        ["class"],
    ],
    withinGroup: "any",
    betweenGroups: "always",
    beforeGroup: "any",
    afterGroup: "always",
    unlisted: "own-group",
    allowBeforeControlFlow: true,
    compactSingleLineDeclarations: true,
    separateMultilineDeclarations: true,
    compactRelatedUse: true,
};

const DECLARATION_KINDS: readonly DeclarationKind[] = [
    "import",
    "const",
    "let",
    "var",
    "function",
    "class",
    "type",
    "interface",
    "enum",
    "namespace",
];

function groupIndex(
    kind: DeclarationKind,
    groups: readonly (readonly DeclarationKind[])[],
    unlisted: "ignore" | "own-group",
): number | null {
    const index = groups.findIndex((group) => group.includes(kind));
    if (index >= 0) {
        return index;
    }
    return unlisted === "own-group" ? groups.length + DECLARATION_KINDS.indexOf(kind) : null;
}

function variableInitializer(statement: AstNode | undefined): AstNode | null {
    if (statement === undefined) return null;
    const declaration = unwrapExport(statement);
    if (declaration.type !== "VariableDeclaration") return null;
    const declarations = nodeArray(declaration.declarations);
    return declarations.length === 1 ? asNode(declarations[0]?.init) : null;
}

function isEmptyObjectAccumulator(statement: AstNode): boolean {
    const initializer = variableInitializer(statement);
    return (
        initializer?.type === "ObjectExpression" && nodeArray(initializer.properties).length === 0
    );
}

function readsPreviousBinding(previous: AstNode, scope: AstNode, sourceCode: SourceCode): boolean {
    const declarations = nodeArray(unwrapExport(previous).declarations);
    if (declarations.length !== 1) return false;
    const id = asNode(declarations[0]?.id);
    if (id?.type !== "Identifier" || typeof id.name !== "string") return false;
    const declared = resolveBinding(id, id.name, sourceCode);
    if (declared === null) return false;
    const [start, end] = rangeOf(scope);
    return declared.references.some((reference) => {
        if (!reference.isRead() && !reference.isWrite()) return false;
        const [from, to] = rangeOf(reference.identifier);
        return from >= start && to <= end;
    });
}

function isCallbackUnit(previous: AstNode, current: AstNode, sourceCode: SourceCode): boolean {
    const currentInitializer = variableInitializer(current);
    if (currentInitializer === null) return false;
    if (currentInitializer.type === "CallExpression") {
        const declarations = nodeArray(unwrapExport(previous).declarations);
        if (declarations.length !== 1) return false;
        const id = asNode(declarations[0]?.id);
        if (id?.type !== "Identifier" || typeof id.name !== "string") return false;
        const declared = resolveBinding(id, id.name, sourceCode);
        const callee = asNode(currentInitializer.callee);
        return (
            declared !== null &&
            callee?.type === "Identifier" &&
            typeof callee.name === "string" &&
            resolveBinding(callee, callee.name, sourceCode) === declared
        );
    }
    // Capturing a callback in another callback does not keep them together.
    return (
        currentInitializer.type === "ObjectExpression" &&
        readsPreviousBinding(previous, currentInitializer, sourceCode)
    );
}

// Distinguish computed arguments from calls wrapped only for formatting.
function wrapsComputation(initializer: AstNode): boolean {
    if (initializer.type === "TSAsExpression" || initializer.type === "AsExpression") return true;
    if (initializer.type !== "CallExpression") return false;
    return nodeArray(initializer.arguments).some((argument) => {
        let computes = false;
        walkAst(argument, (node) => {
            if (
                node.type === "BinaryExpression" ||
                node.type === "CallExpression" ||
                node.type === "TemplateLiteral" ||
                node.type === "ObjectExpression" ||
                node.type === "ConditionalExpression"
            ) {
                computes = true;
            }
        });
        return computes;
    });
}

function verticalCollectionInitializer(initializer: AstNode | null, text: string): boolean {
    if (initializer === null) return false;
    if (initializer.type === "ArrayExpression") return !isSingleLine(initializer, text);
    if (initializer.type !== "NewExpression") return false;
    const arguments_ = nodeArray(initializer.arguments);
    const collection = arguments_.length === 1 ? arguments_[0] : null;
    return collection?.type === "ArrayExpression" && !isSingleLine(collection, text);
}

function isSubstantialConstruction(initializer: AstNode | null, text: string): boolean {
    if (initializer === null || isSingleLine(initializer, text)) return false;
    if (initializer.type === "ConditionalExpression") return false;
    if (initializer.type === "CallExpression" || initializer.type === "NewExpression") {
        // Type arguments alone do not make a construction substantial.
        return nodeArray(initializer.arguments).some((argument) => !isSingleLine(argument, text));
    }
    return true;
}

function separatesVariableDeclarations(
    container: AstNode,
    statements: readonly AstNode[],
    index: number,
    sourceCode: SourceCode,
): boolean {
    const text = sourceCode.text;
    const previous = statements[index - 1];
    const current = statements[index];
    if (previous === undefined || current === undefined) return false;
    const previousDeclaration = unwrapExport(previous);
    const currentDeclaration = unwrapExport(current);
    if (
        previousDeclaration.type !== "VariableDeclaration" ||
        currentDeclaration.type !== "VariableDeclaration"
    ) {
        return false;
    }
    const previousInitializer = variableInitializer(previous);
    const currentInitializer = variableInitializer(current);
    if (isEmptyObjectAccumulator(current) && !isEmptyObjectAccumulator(previous)) {
        return true;
    }
    // Separate computed module constants from the literals that follow.
    if (
        container.type === "Program" &&
        previousInitializer !== null &&
        !isSingleLine(previous, sourceCode.text) &&
        wrapsComputation(previousInitializer) &&
        currentInitializer?.type === "Literal"
    ) {
        return true;
    }
    // Separate module resources from mutable scalar state.
    if (
        container.type === "Program" &&
        previousDeclaration.kind === "const" &&
        (currentDeclaration.kind === "let" || currentDeclaration.kind === "var") &&
        previousInitializer?.type === "NewExpression" &&
        currentInitializer?.type === "Literal"
    ) {
        return true;
    }
    if (
        verticalCollectionInitializer(previousInitializer, text) ||
        verticalCollectionInitializer(currentInitializer, text)
    ) {
        return true;
    }
    if (
        currentInitializer?.type === "ConditionalExpression" &&
        asNode(currentInitializer.consequent)?.type === "ObjectExpression" &&
        asNode(currentInitializer.alternate)?.type === "ObjectExpression" &&
        !isSingleLine(currentInitializer, text) &&
        !readsPreviousBinding(previous, currentInitializer, sourceCode)
    ) {
        return true;
    }
    // Separate substantial constructions at module scope.
    if (
        isSubstantialConstruction(previousInitializer, text) &&
        isSubstantialConstruction(currentInitializer, text) &&
        container.type === "Program"
    ) {
        return true;
    }
    if (
        previousInitializer?.type === "ArrowFunctionExpression" &&
        !isSingleLine(previousInitializer, text) &&
        currentInitializer !== null &&
        !isCallbackUnit(previous, current, sourceCode)
    ) {
        return true;
    }
    // Keep a scalar with a construction only when the construction references it.
    if (
        previousInitializer?.type === "Literal" &&
        currentInitializer !== null &&
        isSubstantialConstruction(currentInitializer, text) &&
        !readsPreviousBinding(previous, currentInitializer, sourceCode)
    ) {
        return true;
    }
    // Separate function-expression groups while allowing small setup closures.
    if (currentInitializer?.type !== "FunctionExpression") return false;
    if (previousInitializer?.type === "FunctionExpression") {
        return !withinNodeBudget(previousInitializer) || !withinNodeBudget(currentInitializer);
    }
    return (
        variableInitializer(statements[index + 1])?.type === "FunctionExpression" &&
        !withinNodeBudget(currentInitializer)
    );
}

export default createLayoutRule<Options>(
    "Group TypeScript declarations and control blank lines within, between, and after declaration groups.",
    [
        {
            type: "object",
            additionalProperties: false,
            properties: {
                ...statementGroupingSchema,
                groups: {
                    type: "array",
                    items: {
                        type: "array",
                        minItems: 1,
                        uniqueItems: true,
                        items: {
                            enum: [
                                "import",
                                "const",
                                "let",
                                "var",
                                "function",
                                "class",
                                "type",
                                "interface",
                                "enum",
                                "namespace",
                            ],
                        },
                    },
                },
                withinGroup: { enum: ["always", "never", "any"] },
                betweenGroups: { enum: ["always", "never", "any"] },
                beforeGroup: { enum: ["always", "never", "any"] },
                afterGroup: { enum: ["always", "never", "any"] },
                unlisted: { enum: ["ignore", "own-group"] },
                allowBeforeControlFlow: { type: "boolean" },
                compactSingleLineDeclarations: { type: "boolean" },
                separateMultilineDeclarations: { type: "boolean" },
                compactRelatedUse: { type: "boolean" },
            },
        },
    ],
    {
        expectedBlank: "Expected a blank line at this declaration-group boundary.",
        unexpectedBlank: "Unexpected blank line between these related statements.",
    },
    (context: RuleContext<Options>) => {
        const options = { ...DEFAULTS, ...context.options[0] };
        const sourceCode = getSourceCode(context);
        return statementContainerVisitors((container, statements) => {
            for (const [previous, current] of pairwise(statements)) {
                const previousKind = declarationKind(previous);
                const currentKind = declarationKind(current);
                let policy: BlankLinePolicy = "any";

                if (previousKind !== null && currentKind !== null) {
                    if (previousKind === "function" && currentKind === "function") {
                        policy = areSameFunctionOverloads(previous, current) ? "never" : "always";
                    } else if (
                        previousKind === "function" ||
                        currentKind === "function" ||
                        previousKind === "class" ||
                        currentKind === "class"
                    ) {
                        policy = options.betweenGroups;
                    } else {
                        const previousGroup = groupIndex(
                            previousKind,
                            options.groups,
                            options.unlisted,
                        );
                        const currentGroup = groupIndex(
                            currentKind,
                            options.groups,
                            options.unlisted,
                        );
                        if (previousGroup === null || currentGroup === null) {
                            continue;
                        }
                        policy =
                            previousGroup === currentGroup
                                ? options.withinGroup
                                : options.betweenGroups;
                        if (previousGroup === currentGroup && previousKind !== "import") {
                            const previousSingle = isSingleLine(previous, sourceCode.text);
                            const currentSingle = isSingleLine(current, sourceCode.text);
                            if (
                                options.withinGroup === "any" &&
                                separatesVariableDeclarations(
                                    container,
                                    statements,
                                    statements.indexOf(current),
                                    sourceCode,
                                )
                            ) {
                                policy = "always";
                            } else if (
                                options.compactSingleLineDeclarations &&
                                previousSingle &&
                                currentSingle
                            ) {
                                policy = "never";
                            } else if (
                                options.separateMultilineDeclarations &&
                                (previousKind === "type" || previousKind === "interface") &&
                                (currentKind === "type" || currentKind === "interface") &&
                                (!previousSingle || !currentSingle)
                            ) {
                                policy = "always";
                            }
                        }
                    }
                } else if (previousKind !== null) {
                    policy =
                        options.allowBeforeControlFlow &&
                        anyStatementSelectorMatches(
                            current,
                            ["if", "for", "while", "do", "switch"],
                            sourceCode.text,
                        )
                            ? "any"
                            : options.afterGroup;
                    if (
                        options.compactRelatedUse &&
                        isSingleLineVariable(previous, sourceCode) &&
                        !anyStatementSelectorMatches(
                            current,
                            ["if", "for", "while", "do", "switch"],
                            sourceCode.text,
                        ) &&
                        (usesDeclaredBindings(previous, current, sourceCode) ||
                            initializesInTry(previous, current, sourceCode))
                    ) {
                        policy = "never";
                    }
                } else if (currentKind !== null) {
                    policy = options.beforeGroup;
                }

                if (
                    (previousKind !== null || currentKind !== null) &&
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
                // A declaration after a conditional starts a new phase: guards
                // belong with the work they validate, not with the work that
                // follows them. An already-claimed compact group keeps priority.
                if (currentKind !== null && previous.type === "IfStatement" && policy !== "never") {
                    policy = "always";
                }
                if (
                    previousKind !== null &&
                    currentKind === null &&
                    (current.type === "ExpressionStatement" ||
                        current.type === "ReturnStatement" ||
                        current.type === "ThrowStatement") &&
                    hasDeferredExecution(current) &&
                    !(
                        options.compactWrappedDeclarations &&
                        returnedClosureBoundary(previous, current, sourceCode)
                    )
                ) {
                    policy = options.afterGroup;
                }

                reportGapPolicy(context, previous, current, policy, {
                    always: "expectedBlank",
                    never: "unexpectedBlank",
                });
            }
        });
    },
);
