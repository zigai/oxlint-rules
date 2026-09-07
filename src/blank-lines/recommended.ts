export const recommendedRules = {
    "blank-lines/control-flow-cuddling": [
        "warn",
        {
            controlFlow: ["if", "for", "while", "do", "switch"],
            maxCuddledStatements: 3,
            includeAssignments: true,
            allowConditionUsage: true,
            allowBodyUsage: "any",
            requireAllBindings: true,
            allowConsecutiveSingleLineIf: true,
        },
    ],
    "blank-lines/blank-line-before-exit": [
        "warn",
        {
            exits: ["return", "throw", "break", "continue"],
            minContainerLines: 3,
            compactAfterSingleLine: true,
            compactJumpsAfterBlock: true,
            exceptAfter: ["if"],
        },
    ],
    "blank-lines/blank-line-after-block": [
        "warn",
        {
            statements: ["if", "for", "while", "do", "switch", "try", "block", "with"],
            ignoreSingleLine: true,
            exceptBefore: ["break", "continue"],
        },
    ],
    "blank-lines/declaration-group-spacing": [
        "warn",
        {
            groups: [
                ["import"],
                ["type", "interface"],
                ["enum", "namespace"],
                ["const", "let", "var"],
                ["function"],
                ["class"],
            ],
            withinGroup: "any",
            compactSingleLineDeclarations: true,
            compactRelatedUse: true,
            betweenGroups: "always",
            beforeGroup: "any",
            afterGroup: "always",
            allowBeforeControlFlow: true,
        },
    ],
    "blank-lines/expression-group-spacing": [
        "warn",
        {
            kinds: ["assignment", "await", "call", "new", "tagged-template", "update", "yield"],
            groupByKind: false,
            withinGroup: "any",
            betweenGroups: "always",
            beforeGroup: "any",
            afterGroup: "always",
            exceptBefore: ["return", "throw", "break", "continue"],
            allowAssignmentBeforeControlFlow: true,
        },
    ],
    "blank-lines/switch-case-spacing": [
        "warn",
        {
            maxCuddledLines: 2,
            longCase: "never",
            shortCase: "never",
            emptyCase: "never",
            ignoreFallthrough: true,
        },
    ],

    "blank-lines/block-boundary-spacing": [
        "warn",
        {
            blocks: "never",
            classes: "never",
            switches: "never",
            typeBlocks: "never",
            namespaces: "never",
            staticBlocks: "never",
            allowSingleLine: true,
        },
    ],
    "blank-lines/lines-between-class-members": [
        "warn",
        {
            default: "always",
            exceptAfterSingleLine: false,
            exceptBetweenOverloads: true,
            pairs: [{ blankLine: "never", prev: "field", next: "field" }],
        },
    ],
    "blank-lines/lines-between-type-members": [
        "warn",
        {
            default: "never",
            exceptBetweenOverloads: true,
            pairs: [
                { blankLine: "always", prev: "multiline", next: "*" },
                { blankLine: "always", prev: "*", next: "multiline" },
            ],
        },
    ],
    "blank-lines/comment-group-spacing": [
        "warn",
        {
            beforeLine: "always",
            afterLine: "any",
            beforeBlock: "always",
            afterBlock: "any",
            standaloneOnly: true,
            keepConsecutiveTogether: true,
            allowAtBlockBoundary: true,
        },
    ],
    "blank-lines/max-consecutive-blank-lines": ["warn", { max: 1, maxBOF: 0, maxEOF: 0 }],
} as const;

// Test phases are author-selected. Keep their existing boundaries instead of
// inferring an assertion API from callee names or traversing callback bodies.
const preserveTestGroups = {
    compactShortBodies: false,
    compactInitializations: false,
    compactConditionalUpdates: false,
    compactWrappedDeclarations: false,
    compactRelatedControlFlow: false,
    compactDestructuredSetup: false,
} as const;

export const testRules = {
    "blank-lines/declaration-group-spacing": [
        "warn",
        {
            ...recommendedRules["blank-lines/declaration-group-spacing"][1],
            ...preserveTestGroups,
            compactSingleLineDeclarations: false,
            compactRelatedUse: false,
            afterGroup: "any",
        },
    ],
    "blank-lines/expression-group-spacing": [
        "warn",
        {
            ...recommendedRules["blank-lines/expression-group-spacing"][1],
            ...preserveTestGroups,
            afterGroup: "any",
        },
    ],
    "blank-lines/control-flow-cuddling": [
        "warn",
        {
            ...recommendedRules["blank-lines/control-flow-cuddling"][1],
            ...preserveTestGroups,
            compactRelatedSetup: false,
        },
    ],
    "blank-lines/blank-line-before-exit": [
        "warn",
        {
            ...recommendedRules["blank-lines/blank-line-before-exit"][1],
            ...preserveTestGroups,
        },
    ],
    "blank-lines/blank-line-after-block": [
        "warn",
        {
            ...recommendedRules["blank-lines/blank-line-after-block"][1],
            ...preserveTestGroups,
        },
    ],
} as const;

export const testFiles = ["js", "jsx", "ts", "tsx", "mjs", "mts", "cjs", "cts"].flatMap(
    (extension) => [`**/*.test.${extension}`, `**/*.spec.${extension}`],
);

export default recommendedRules;
