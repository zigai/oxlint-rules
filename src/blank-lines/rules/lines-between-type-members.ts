import { asNode, isSingleLine, typeMembers } from "../ast.ts";
import { createLayoutRule, pairwise, reportGapPolicy } from "../rule-utils.ts";
import { anyTypeSelectorMatches, isTypeOverload, type TypeMemberSelector } from "../selectors.ts";
import { getSourceCode } from "../spacing.ts";
import type { AstNode, BlankLinePolicy, RuleContext } from "../types.ts";

export interface TypeMemberPair {
    readonly blankLine: BlankLinePolicy;
    readonly prev: TypeMemberSelector | readonly TypeMemberSelector[];
    readonly next: TypeMemberSelector | readonly TypeMemberSelector[];
}

export interface LinesBetweenTypeMembersOptions {
    readonly default?: BlankLinePolicy;
    readonly pairs?: readonly TypeMemberPair[];
    readonly exceptAfterSingleLine?: boolean;
    readonly exceptBetweenOverloads?: boolean;
}

type Options = readonly [LinesBetweenTypeMembersOptions?];

const DEFAULTS: Required<LinesBetweenTypeMembersOptions> = {
    default: "never",
    pairs: [],
    exceptAfterSingleLine: false,
    exceptBetweenOverloads: true,
};

const SELECTORS = [
    "*",
    "call-signature",
    "construct-signature",
    "enum-member",
    "getter",
    "index-signature",
    "method",
    "multiline",
    "overload",
    "property",
    "setter",
    "singleline",
] as const;

function memberName(member: AstNode): string | null {
    const key = asNode(member.key ?? member.id);
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
    if (!isTypeOverload(previous) || !isTypeOverload(current)) {
        return false;
    }
    const previousName = memberName(previous);
    const currentName = memberName(current);
    if (previous.type === "TSCallSignatureDeclaration" && current.type === previous.type) {
        return true;
    }
    if (previous.type === "TSConstructSignatureDeclaration" && current.type === previous.type) {
        return true;
    }
    return previousName !== null && previousName === currentName;
}

function pairPolicy(
    previous: AstNode,
    current: AstNode,
    options: Required<LinesBetweenTypeMembersOptions>,
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
            anyTypeSelectorMatches(previous, pair.prev, sourceText) &&
            anyTypeSelectorMatches(current, pair.next, sourceText)
        ) {
            policy = pair.blankLine;
        }
    }
    return policy;
}

export default createLayoutRule<Options>(
    "Require or disallow blank lines between TypeScript interface, type-literal, and enum members.",
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
        expectedBlank: "Expected a blank line between these type members.",
        unexpectedBlank: "Unexpected blank line between these type members.",
    },
    (context: RuleContext<Options>) => {
        const options = { ...DEFAULTS, ...context.options[0] };
        const sourceCode = getSourceCode(context);
        const visit = (node: AstNode): void => {
            for (const [previous, current] of pairwise(typeMembers(node))) {
                reportGapPolicy(
                    context,
                    previous,
                    current,
                    pairPolicy(previous, current, options, sourceCode.text),
                    { always: "expectedBlank", never: "unexpectedBlank" },
                );
            }
        };
        return {
            TSInterfaceBody: visit,
            TSTypeLiteral: visit,
            TSEnumBody: visit,
        };
    },
);
