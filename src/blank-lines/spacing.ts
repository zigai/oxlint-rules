import type {
    AstNode,
    BlankLinePolicy,
    RuleContext,
    SourceCode,
    TextEdit,
    Token,
} from "./types.ts";

export interface GapInfo {
    readonly range: readonly [number, number];
    readonly text: string;
    readonly lineBreaks: number;
    readonly blankLines: number;
    readonly whitespaceOnly: boolean;
    readonly trailingIndent: string;
}

const LINE_BREAK_RE = /\r\n|\r|\n/g;
const WHITESPACE_RE = /^[\t \r\n]*$/;

export function getSourceCode(context: RuleContext): SourceCode {
    const sourceCode = context.sourceCode ?? context.getSourceCode?.();
    if (sourceCode === undefined) {
        throw new Error("The lint context does not expose SourceCode.");
    }
    return sourceCode;
}

export function rangeOf(node: AstNode): readonly [number, number] {
    if (node.range !== undefined) {
        return node.range;
    }
    if (typeof node.start === "number" && typeof node.end === "number") {
        return [node.start, node.end];
    }
    throw new Error(`Node ${node.type} has no source range.`);
}

export function startOf(node: AstNode): number {
    return rangeOf(node)[0];
}

export function endOf(node: AstNode): number {
    return rangeOf(node)[1];
}

export function detectEol(text: string): "\n" | "\r\n" | "\r" {
    const match = /\r\n|\r|\n/.exec(text);
    const eol = match?.[0];
    if (eol === "\r\n" || eol === "\r") {
        return eol;
    }
    return "\n";
}

export function countLineBreaks(text: string): number {
    return [...text.matchAll(LINE_BREAK_RE)].length;
}

export function trailingIndent(text: string): string {
    const lastLf = text.lastIndexOf("\n");
    const lastCr = text.lastIndexOf("\r");
    const lastBreak = Math.max(lastLf, lastCr);
    return lastBreak === -1 ? "" : text.slice(lastBreak + 1);
}

export function inspectRange(sourceCode: SourceCode, range: readonly [number, number]): GapInfo {
    const text = sourceCode.text.slice(range[0], range[1]);
    const lineBreaks = countLineBreaks(text);
    return {
        range,
        text,
        lineBreaks,
        blankLines: Math.max(0, lineBreaks - 1),
        whitespaceOnly: WHITESPACE_RE.test(text),
        trailingIndent: trailingIndent(text),
    };
}

export function inspectGap(sourceCode: SourceCode, left: AstNode, right: AstNode): GapInfo {
    let start = endOf(left);
    const text = sourceCode.text;
    const rightStart = startOf(right);
    while (start < rightStart && (text[start] === " " || text[start] === "\t")) {
        start += 1;
    }
    if (start < rightStart && (text[start] === "," || text[start] === ";")) {
        start += 1;
    }
    return inspectRange(sourceCode, [start, rightStart]);
}

export function replacementForBlankLines(
    gap: GapInfo,
    blankLines: number,
    eol: string,
): string | null {
    if (!gap.whitespaceOnly || gap.lineBreaks === 0 || blankLines < 0) {
        return null;
    }
    return eol.repeat(blankLines + 1) + gap.trailingIndent;
}

export function editForPolicy(
    sourceCode: SourceCode,
    left: AstNode,
    right: AstNode,
    policy: Exclude<BlankLinePolicy, "any">,
): TextEdit | null {
    const gap = inspectGap(sourceCode, left, right);
    if (!gap.whitespaceOnly || gap.lineBreaks === 0) {
        return null;
    }

    const desiredBlankLines = policy === "always" ? 1 : 0;
    const violated = policy === "always" ? gap.blankLines < 1 : gap.blankLines > 0;
    if (!violated) {
        return null;
    }

    const replacement = replacementForBlankLines(
        gap,
        desiredBlankLines,
        detectEol(sourceCode.text),
    );
    return replacement === null ? null : { range: gap.range, text: replacement };
}

export function editForMaximumBlankLines(
    sourceCode: SourceCode,
    range: readonly [number, number],
    maximum: number,
): TextEdit | null {
    const gap = inspectRange(sourceCode, range);
    if (!gap.whitespaceOnly || gap.lineBreaks === 0 || gap.blankLines <= maximum) {
        return null;
    }
    const replacement = replacementForBlankLines(gap, maximum, detectEol(sourceCode.text));
    return replacement === null ? null : { range, text: replacement };
}

export function firstToken(sourceCode: SourceCode, node: AstNode): Token | null {
    return sourceCode.getFirstToken?.(node, { includeComments: false }) ?? null;
}

export function lastToken(sourceCode: SourceCode, node: AstNode): Token | null {
    return sourceCode.getLastToken?.(node, { includeComments: false }) ?? null;
}

export function tokenValue(token: Token | null): string | undefined {
    return token?.value ?? (token === null ? undefined : undefined);
}

export function isWhitespaceOnly(text: string): boolean {
    return WHITESPACE_RE.test(text);
}
