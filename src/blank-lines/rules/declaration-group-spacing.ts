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
import { areSameFunctionOverloads, asNode, isSingleLine, nodeArray, unwrapExport } from "../ast.ts";
import { hasDeferredExecution } from "../references.ts";
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
import { getSourceCode } from "../spacing.ts";
import type { AstNode, BlankLinePolicy, RuleContext } from "../types.ts";

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

function separatesVariableDeclarations(
    container: AstNode,
    statements: readonly AstNode[],
    index: number,
    text: string,
): boolean {
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
    // Separate allocated module resources from scalar accounting state, not
    // ordinary constant keys followed by an enable flag or local setup.
    if (
        container.type === "Program" &&
        previousDeclaration.kind === "const" &&
        (currentDeclaration.kind === "let" || currentDeclaration.kind === "var") &&
        previousInitializer?.type === "NewExpression" &&
        currentInitializer?.type === "Literal"
    ) {
        return true;
    }
    // A vertically laid-out list is a declaration unit, unlike a wrapped call
    // or a multiline type annotation on a scalar binding.
    if (
        (previousInitializer?.type === "ArrayExpression" &&
            !isSingleLine(previousInitializer, text)) ||
        (currentInitializer?.type === "ArrayExpression" && !isSingleLine(currentInitializer, text))
    ) {
        return true;
    }
    if (
        currentInitializer?.type === "ConditionalExpression" &&
        asNode(currentInitializer.consequent)?.type === "ObjectExpression" &&
        asNode(currentInitializer.alternate)?.type === "ObjectExpression" &&
        !isSingleLine(currentInitializer, text)
    ) {
        return true;
    }
    // Function-expression peers form an implementation section. Small setup
    // closures and a single installed wrapper do not create such a section.
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
                                    sourceCode.text,
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
