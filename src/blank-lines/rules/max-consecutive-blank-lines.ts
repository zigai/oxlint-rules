import { createLayoutRule, editFix } from "../rule-utils.ts";
import { isAttachmentSensitiveComment, sourceItems } from "../source-items.ts";
import {
    countLineBreaks,
    detectEol,
    editForMaximumBlankLines,
    getSourceCode,
    isWhitespaceOnly,
    rangeOf,
    trailingIndent,
} from "../spacing.ts";
import type { AstNode, RuleContext, TextEdit } from "../types.ts";

export interface MaxConsecutiveBlankLinesOptions {
    readonly max?: number;
    readonly maxBOF?: number;
    readonly maxEOF?: number;
}

type Options = readonly [MaxConsecutiveBlankLinesOptions?];

const DEFAULTS: Required<MaxConsecutiveBlankLinesOptions> = {
    max: 1,
    maxBOF: 0,
    maxEOF: 0,
};

function bofEdit(text: string, end: number, maximum: number): TextEdit | null {
    const gap = text.slice(0, end);
    const breaks = countLineBreaks(gap);
    if (!isWhitespaceOnly(gap) || breaks <= maximum) {
        return null;
    }
    return {
        range: [0, end],
        text: detectEol(text).repeat(maximum) + trailingIndent(gap),
    };
}

function eofEdit(text: string, start: number, maximum: number): TextEdit | null {
    const gap = text.slice(start);
    const breaks = countLineBreaks(gap);
    const maximumBreaks = maximum + 1;
    if (!isWhitespaceOnly(gap) || breaks <= maximumBreaks) {
        return null;
    }
    return {
        range: [start, text.length],
        text: detectEol(text).repeat(maximumBreaks),
    };
}

export default createLayoutRule<Options>(
    "Limit consecutive blank lines outside strings, templates, and comments, including file boundaries.",
    [
        {
            type: "object",
            additionalProperties: false,
            properties: {
                max: { type: "integer", minimum: 0 },
                maxBOF: { type: "integer", minimum: 0 },
                maxEOF: { type: "integer", minimum: 0 },
            },
        },
    ],
    { tooMany: "Too many consecutive blank lines; the configured maximum is {{maximum}}." },
    (context: RuleContext<Options>) => {
        const options = { ...DEFAULTS, ...context.options[0] };
        const sourceCode = getSourceCode(context);
        return {
            Program(program: AstNode): void {
                const items = sourceItems(sourceCode, program);
                if (items.length === 0) {
                    if (sourceCode.text.length > 0 && isWhitespaceOnly(sourceCode.text)) {
                        context.report({
                            node: program,
                            messageId: "tooMany",
                            data: { maximum: 0 },
                            fix: editFix({ range: [0, sourceCode.text.length], text: "" }, true),
                        });
                    }
                    return;
                }

                const first = items[0]!;
                const atStart = bofEdit(sourceCode.text, rangeOf(first.node)[0], options.maxBOF);
                if (atStart !== null) {
                    context.report({
                        node: first.node,
                        messageId: "tooMany",
                        data: { maximum: options.maxBOF },
                        fix: editFix(atStart, true),
                    });
                }

                for (let index = 1; index < items.length; index += 1) {
                    const previous = items[index - 1]!;
                    const current = items[index]!;
                    if (
                        isAttachmentSensitiveComment(previous, sourceCode.text) ||
                        isAttachmentSensitiveComment(current, sourceCode.text)
                    ) {
                        continue;
                    }
                    const edit = editForMaximumBlankLines(
                        sourceCode,
                        [rangeOf(previous.node)[1], rangeOf(current.node)[0]],
                        options.max,
                    );
                    if (edit !== null) {
                        context.report({
                            node: current.node,
                            messageId: "tooMany",
                            data: { maximum: options.max },
                            fix: editFix(edit, true),
                        });
                    }
                }

                const last = items.at(-1)!;
                const atEnd = eofEdit(sourceCode.text, rangeOf(last.node)[1], options.maxEOF);
                if (atEnd !== null) {
                    context.report({
                        node: last.node,
                        messageId: "tooMany",
                        data: { maximum: options.maxEOF },
                        fix: editFix(atEnd, true),
                    });
                }
            },
        };
    },
);
