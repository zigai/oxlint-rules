import { asNode, classMembers, isSingleLine } from "../ast.ts";
import { createLayoutRule, pairwise, reportGapPolicy } from "../rule-utils.ts";
import {
    anyClassSelectorMatches,
    isClassOverload,
    type ClassMemberSelector,
} from "../selectors.ts";
import { getSourceCode } from "../spacing.ts";
import type { AstNode, BlankLinePolicy, RuleContext } from "../types.ts";

export interface ClassMemberPair {
    readonly blankLine: BlankLinePolicy;
    readonly prev: ClassMemberSelector | readonly ClassMemberSelector[];
    readonly next: ClassMemberSelector | readonly ClassMemberSelector[];
}

export interface LinesBetweenClassMembersOptions {
    readonly default?: BlankLinePolicy;
    readonly pairs?: readonly ClassMemberPair[];
    readonly exceptAfterSingleLine?: boolean;
    readonly exceptBetweenOverloads?: boolean;
}

type Options = readonly [LinesBetweenClassMembersOptions?];

const DEFAULTS: Required<LinesBetweenClassMembersOptions> = {
    default: "always",
    pairs: [],
    exceptAfterSingleLine: false,
    exceptBetweenOverloads: true,
};

const SELECTORS = [
    "*",
    "abstract",
    "accessor",
    "constructor",
    "declare",
    "field",
    "getter",
    "index-signature",
    "method",
    "multiline",
    "overload",
    "setter",
    "singleline",
    "static",
    "static-block",
] as const;

function keyName(member: AstNode): string | null {
    const key = asNode(member.key);
    if (key === null) {
        return null;
    }
    if (typeof key.name === "string") {
        return key.name;
    }
    if (typeof key.value === "string" || typeof key.value === "number") {
        return String(key.value);
    }
    return null;
}

function sameOverloadGroup(previous: AstNode, current: AstNode): boolean {
    if (!isClassOverload(previous) && !isClassOverload(current)) {
        return false;
    }
    const previousName = keyName(previous);
    const currentName = keyName(current);
    return (
        previousName !== null &&
        previousName === currentName &&
        previous.static === current.static &&
        previous.kind === current.kind
    );
}

function pairPolicy(
    previous: AstNode,
    current: AstNode,
    options: Required<LinesBetweenClassMembersOptions>,
    sourceText: string,
): BlankLinePolicy {
    if (options.exceptBetweenOverloads && sameOverloadGroup(previous, current)) {
        return "never";
    }
    if (options.exceptAfterSingleLine && isSingleLine(previous, sourceText)) {
        return "any";
    }

    let policy = options.default;
    for (const pair of options.pairs) {
        if (
            anyClassSelectorMatches(previous, pair.prev, sourceText) &&
            anyClassSelectorMatches(current, pair.next, sourceText)
        ) {
            policy = pair.blankLine;
        }
    }
    return policy;
}

export default createLayoutRule<Options>(
    "Require or disallow blank lines between JavaScript and TypeScript class members.",
    [
        {
            type: "object",
            additionalProperties: false,
            properties: {
                default: { enum: ["always", "never", "any"] },
                exceptAfterSingleLine: { type: "boolean" },
                exceptBetweenOverloads: { type: "boolean" },
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
        expectedBlank: "Expected a blank line between these class members.",
        unexpectedBlank: "Unexpected blank line between these class members.",
    },
    (context: RuleContext<Options>) => {
        const options = { ...DEFAULTS, ...context.options[0] };
        const sourceCode = getSourceCode(context);
        return {
            ClassBody(node): void {
                for (const [previous, current] of pairwise(classMembers(node))) {
                    reportGapPolicy(
                        context,
                        previous,
                        current,
                        pairPolicy(previous, current, options, sourceCode.text),
                        { always: "expectedBlank", never: "unexpectedBlank" },
                    );
                }
            },
        };
    },
);
