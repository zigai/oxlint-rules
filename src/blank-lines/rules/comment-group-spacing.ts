import { createLayoutRule, editFix } from "../rule-utils.ts";
import { walkAst } from "../ast.ts";
import { isAttachmentSensitiveComment, sourceItems, type SourceItem } from "../source-items.ts";
import { editForPolicy, getSourceCode, inspectGap, rangeOf, tokenValue } from "../spacing.ts";
import type { AstNode, BlankLinePolicy, RuleContext } from "../types.ts";

export interface CommentGroupSpacingOptions {
    readonly beforeLine?: BlankLinePolicy;
    readonly afterLine?: BlankLinePolicy;
    readonly beforeBlock?: BlankLinePolicy;
    readonly afterBlock?: BlankLinePolicy;
    readonly standaloneOnly?: boolean;
    readonly keepConsecutiveTogether?: boolean;
    readonly allowAtBlockBoundary?: boolean;
}

type Options = readonly [CommentGroupSpacingOptions?];

const DEFAULTS: Required<CommentGroupSpacingOptions> = {
    beforeLine: "always",
    afterLine: "any",
    beforeBlock: "always",
    afterBlock: "any",
    standaloneOnly: true,
    keepConsecutiveTogether: true,
    allowAtBlockBoundary: true,
};

const COMMENT_CONTAINERS = new Set([
    "Program",
    "BlockStatement",
    "ClassBody",
    "StaticBlock",
    "SwitchStatement",
    "SwitchCase",
    "TSModuleBlock",
    "TSInterfaceBody",
    "TSTypeLiteral",
    "TSEnumBody",
]);

function commentContainers(program: AstNode): readonly AstNode[] {
    const nodes: AstNode[] = [];
    walkAst(program, (node) => {
        nodes.push(node);
    });
    return nodes.sort((left, right) => {
        const [leftStart, leftEnd] = rangeOf(left);
        const [rightStart, rightEnd] = rangeOf(right);
        return leftEnd - leftStart - (rightEnd - rightStart);
    });
}

function lineBounds(text: string, start: number, end: number): readonly [number, number] {
    let lineStart = start;
    while (lineStart > 0 && text[lineStart - 1] !== "\n" && text[lineStart - 1] !== "\r") {
        lineStart -= 1;
    }
    let lineEnd = end;
    while (lineEnd < text.length && text[lineEnd] !== "\n" && text[lineEnd] !== "\r") {
        lineEnd += 1;
    }
    return [lineStart, lineEnd];
}

function isStandalone(item: SourceItem, text: string): boolean {
    const [start, end] = rangeOf(item.node);
    const [lineStart, lineEnd] = lineBounds(text, start, end);
    return (
        /^[\t ]*$/.test(text.slice(lineStart, start)) && /^[\t ]*$/.test(text.slice(end, lineEnd))
    );
}

function isOpenDelimiter(item: SourceItem | undefined): boolean {
    const value = item === undefined ? undefined : tokenValue(item.node);
    return value === "{" || value === "[" || value === "(";
}

function isCloseDelimiter(item: SourceItem | undefined): boolean {
    const value = item === undefined ? undefined : tokenValue(item.node);
    return value === "}" || value === "]" || value === ")";
}

function beforePolicy(
    item: SourceItem,
    options: Required<CommentGroupSpacingOptions>,
): BlankLinePolicy {
    return item.commentKind === "line" ? options.beforeLine : options.beforeBlock;
}

function afterPolicy(
    item: SourceItem,
    options: Required<CommentGroupSpacingOptions>,
): BlankLinePolicy {
    return item.commentKind === "line" ? options.afterLine : options.afterBlock;
}

export default createLayoutRule<Options>(
    "Control blank lines around standalone line- and block-comment groups without moving comments.",
    [
        {
            type: "object",
            additionalProperties: false,
            properties: {
                beforeLine: { enum: ["always", "never", "any"] },
                afterLine: { enum: ["always", "never", "any"] },
                beforeBlock: { enum: ["always", "never", "any"] },
                afterBlock: { enum: ["always", "never", "any"] },
                standaloneOnly: { type: "boolean" },
                keepConsecutiveTogether: { type: "boolean" },
                allowAtBlockBoundary: { type: "boolean" },
            },
        },
    ],
    {
        expectedBefore: "Expected a blank line before this comment group.",
        unexpectedBefore: "Unexpected blank line before this comment group.",
        expectedAfter: "Expected a blank line after this comment group.",
        unexpectedAfter: "Unexpected blank line after this comment group.",
    },
    (context: RuleContext<Options>) => {
        const options = { ...DEFAULTS, ...context.options[0] };
        const sourceCode = getSourceCode(context);
        return {
            Program(program: AstNode): void {
                const items = sourceItems(sourceCode, program);
                const containers = commentContainers(program);
                let index = 0;
                while (index < items.length) {
                    const first = items[index];
                    if (
                        first === undefined ||
                        !first.isComment ||
                        (options.standaloneOnly && !isStandalone(first, sourceCode.text))
                    ) {
                        index += 1;
                        continue;
                    }

                    let lastIndex = index;
                    if (options.keepConsecutiveTogether) {
                        while (lastIndex + 1 < items.length) {
                            const left = items[lastIndex];
                            const right = items[lastIndex + 1];
                            if (
                                left === undefined ||
                                right === undefined ||
                                !right.isComment ||
                                (options.standaloneOnly && !isStandalone(right, sourceCode.text))
                            ) {
                                break;
                            }
                            const gap = inspectGap(sourceCode, left.node, right.node);
                            if (!gap.whitespaceOnly || gap.blankLines > 0) {
                                break;
                            }
                            lastIndex += 1;
                        }
                    }

                    const last = items[lastIndex]!;
                    const [start] = rangeOf(first.node);
                    const [, end] = rangeOf(last.node);
                    const container = containers.find((node) => {
                        const [from, to] = rangeOf(node);
                        return from <= start && to >= end;
                    });
                    // Expression-internal comments belong to the formatter. In
                    // particular, padding a binary operand comment does not converge.
                    if (container === undefined || !COMMENT_CONTAINERS.has(container.type)) {
                        index = lastIndex + 1;
                        continue;
                    }
                    const group = items.slice(index, lastIndex + 1);
                    if (group.some((item) => isAttachmentSensitiveComment(item, sourceCode.text))) {
                        index = lastIndex + 1;
                        continue;
                    }
                    const previous = items[index - 1];
                    const next = items[lastIndex + 1];

                    if (
                        previous !== undefined &&
                        !(options.allowAtBlockBoundary && isOpenDelimiter(previous))
                    ) {
                        const policy = beforePolicy(first, options);
                        if (policy !== "any") {
                            const edit = editForPolicy(
                                sourceCode,
                                previous.node,
                                first.node,
                                policy,
                            );
                            if (edit !== null) {
                                context.report({
                                    node: first.node,
                                    messageId:
                                        policy === "always" ? "expectedBefore" : "unexpectedBefore",
                                    fix: editFix(edit),
                                });
                            }
                        }
                    }

                    if (
                        next !== undefined &&
                        !(options.allowAtBlockBoundary && isCloseDelimiter(next))
                    ) {
                        const policy = afterPolicy(last, options);
                        if (policy !== "any") {
                            const edit = editForPolicy(sourceCode, last.node, next.node, policy);
                            if (edit !== null) {
                                context.report({
                                    node: last.node,
                                    messageId:
                                        policy === "always" ? "expectedAfter" : "unexpectedAfter",
                                    fix: editFix(edit),
                                });
                            }
                        }
                    }

                    index = lastIndex + 1;
                }
            },
        };
    },
);
