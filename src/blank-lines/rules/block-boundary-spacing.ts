import { asNode } from "../ast.ts";
import { createLayoutRule, editFix } from "../rule-utils.ts";
import { editForPolicy, getSourceCode, rangeOf, tokenValue } from "../spacing.ts";
import type {
    AstNode,
    BlankLinePolicy,
    RuleContext,
    RuleListener,
    SourceCode,
    Token,
} from "../types.ts";

export interface BlockBoundarySpacingOptions {
    readonly blocks?: BlankLinePolicy;
    readonly classes?: BlankLinePolicy;
    readonly switches?: BlankLinePolicy;
    readonly typeBlocks?: BlankLinePolicy;
    readonly namespaces?: BlankLinePolicy;
    readonly staticBlocks?: BlankLinePolicy;
    readonly allowSingleLine?: boolean;
}

type Options = readonly [BlockBoundarySpacingOptions?];

const DEFAULTS: Required<BlockBoundarySpacingOptions> = {
    blocks: "never",
    classes: "never",
    switches: "never",
    typeBlocks: "never",
    namespaces: "never",
    staticBlocks: "never",
    allowSingleLine: true,
};

function policyFor(node: AstNode, options: Required<BlockBoundarySpacingOptions>): BlankLinePolicy {
    switch (node.type) {
        case "BlockStatement":
            return options.blocks;
        case "ClassBody":
            return options.classes;
        case "SwitchStatement":
            return options.switches;
        case "TSInterfaceBody":
        case "TSTypeLiteral":
        case "TSEnumBody":
            return options.typeBlocks;
        case "TSModuleBlock":
            return options.namespaces;
        case "StaticBlock":
            return options.staticBlocks;
        default:
            return "any";
    }
}

function allTokens(sourceCode: SourceCode, node: AstNode): readonly Token[] {
    return sourceCode.getTokens?.(node, { includeComments: true }) ?? [];
}

function braces(sourceCode: SourceCode, node: AstNode): readonly [Token, Token] | null {
    const tokens = allTokens(sourceCode, node);
    if (tokens.length < 2) {
        return null;
    }

    let closingIndex = -1;
    for (let index = tokens.length - 1; index >= 0; index -= 1) {
        const token = tokens[index];
        if (token !== undefined && tokenValue(token) === "}") {
            closingIndex = index;
            break;
        }
    }
    if (closingIndex <= 0) {
        return null;
    }

    let openingIndex = tokens.findIndex((token) => tokenValue(token) === "{");
    if (node.type === "SwitchStatement") {
        const firstCase = Array.isArray(node.cases)
            ? node.cases.map(asNode).find((item): item is AstNode => item !== null)
            : undefined;
        const upperBound =
            firstCase === undefined ? rangeOf(tokens[closingIndex]!)[0] : rangeOf(firstCase)[0];
        for (let index = closingIndex - 1; index >= 0; index -= 1) {
            const token = tokens[index];
            if (
                token !== undefined &&
                tokenValue(token) === "{" &&
                rangeOf(token)[0] < upperBound
            ) {
                openingIndex = index;
                break;
            }
        }
    }

    if (openingIndex < 0 || openingIndex >= closingIndex) {
        return null;
    }
    return [tokens[openingIndex]!, tokens[closingIndex]!];
}

function enforceBoundary(
    context: RuleContext,
    node: AstNode,
    policy: BlankLinePolicy,
    allowSingleLine: boolean,
): void {
    if (policy === "any") {
        return;
    }

    const sourceCode = getSourceCode(context);
    const found = braces(sourceCode, node);
    if (found === null) {
        return;
    }
    const [opening, closing] = found;
    const tokens = allTokens(sourceCode, node);
    const openIndex = tokens.indexOf(opening);
    const closeIndex = tokens.indexOf(closing);
    const inside = tokens.slice(openIndex + 1, closeIndex);
    if (inside.length === 0) {
        return;
    }

    if (allowSingleLine) {
        const openLoc = opening.loc?.end;
        const closeLoc = closing.loc?.start;
        if (openLoc !== undefined && closeLoc !== undefined && openLoc.line === closeLoc.line) {
            return;
        }
    }

    const firstInside = inside[0];
    const lastInside = inside.at(-1);
    if (firstInside !== undefined) {
        const edit = editForPolicy(sourceCode, opening, firstInside, policy);
        if (edit !== null) {
            context.report({
                node: firstInside,
                messageId: policy === "always" ? "expectedAfterOpen" : "unexpectedAfterOpen",
                fix: editFix(edit),
            });
        }
    }
    if (lastInside !== undefined) {
        const edit = editForPolicy(sourceCode, lastInside, closing, policy);
        if (edit !== null) {
            context.report({
                node: closing,
                messageId: policy === "always" ? "expectedBeforeClose" : "unexpectedBeforeClose",
                fix: editFix(edit),
            });
        }
    }
}

export default createLayoutRule<Options>(
    "Require or disallow padded blank lines at block, class, switch, namespace, and type-body boundaries.",
    [
        {
            type: "object",
            additionalProperties: false,
            properties: {
                blocks: { enum: ["always", "never", "any"] },
                classes: { enum: ["always", "never", "any"] },
                switches: { enum: ["always", "never", "any"] },
                typeBlocks: { enum: ["always", "never", "any"] },
                namespaces: { enum: ["always", "never", "any"] },
                staticBlocks: { enum: ["always", "never", "any"] },
                allowSingleLine: { type: "boolean" },
            },
        },
    ],
    {
        expectedAfterOpen: "Expected a blank line after the opening brace.",
        unexpectedAfterOpen: "Unexpected blank line after the opening brace.",
        expectedBeforeClose: "Expected a blank line before the closing brace.",
        unexpectedBeforeClose: "Unexpected blank line before the closing brace.",
    },
    (context: RuleContext<Options>): RuleListener => {
        const options = { ...DEFAULTS, ...context.options[0] };
        const visit = (node: AstNode): void => {
            enforceBoundary(context, node, policyFor(node, options), options.allowSingleLine);
        };
        return {
            BlockStatement: visit,
            ClassBody: visit,
            SwitchStatement: visit,
            TSInterfaceBody: visit,
            TSTypeLiteral: visit,
            TSEnumBody: visit,
            TSModuleBlock: visit,
            StaticBlock: visit,
        };
    },
);
