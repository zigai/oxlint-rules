import {
    compactStatementBoundary,
    initializesInTry,
    isSingleLineVariable,
    usesDeclaredBindings,
    statementGroupingDefaults,
    statementGroupingSchema,
    type StatementGroupingOptions,
} from "../related-statements.ts";
import { areSameFunctionOverloads } from "../ast.ts";
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
import type { BlankLinePolicy, RuleContext } from "../types.ts";

export interface DeclarationGroupSpacingOptions extends StatementGroupingOptions {
    readonly groups?: readonly (readonly DeclarationKind[])[];
    readonly withinGroup?: BlankLinePolicy;
    readonly betweenGroups?: BlankLinePolicy;
    readonly beforeGroup?: BlankLinePolicy;
    readonly afterGroup?: BlankLinePolicy;
    readonly unlisted?: "ignore" | "own-group";
    readonly allowBeforeControlFlow?: boolean;
    readonly compactSingleLineDeclarations?: boolean;
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
                compactRelatedUse: { type: "boolean" },
            },
        },
    ],
    {
        expectedBlank: "Expected a blank line at this declaration-group boundary.",
        unexpectedBlank: "Unexpected blank line inside this declaration group.",
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
                        if (
                            previousGroup === currentGroup &&
                            options.compactSingleLineDeclarations &&
                            isSingleLineVariable(previous, sourceCode) &&
                            isSingleLineVariable(current, sourceCode)
                        ) {
                            policy = "never";
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
                    hasDeferredExecution(current)
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
