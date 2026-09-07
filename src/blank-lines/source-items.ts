import { rangeOf } from "./spacing.ts";
import type { AstNode, SourceCode, Token } from "./types.ts";

export interface SourceItem {
    readonly node: Token;
    readonly isComment: boolean;
    readonly commentKind: "line" | "block" | null;
}

/**
 * Comments whose adjacency can affect another tool are excluded from spacing
 * edits. This covers JSDoc, TypeScript suppression comments, lint/format
 * directives, coverage directives, triple-slash references, and bundler hints.
 */
export function isAttachmentSensitiveComment(item: SourceItem, sourceText: string): boolean {
    if (!item.isComment) {
        return false;
    }

    const [start, end] = rangeOf(item.node);
    const raw = sourceText.slice(start, end);
    if (raw.startsWith("/**") || raw.startsWith("/*!")) {
        return true;
    }
    if (/^\/\/\/\s*<(?:reference|amd-|lib|types)\b/i.test(raw)) {
        return true;
    }

    const content = raw
        .replace(/^\/\/+/, "")
        .replace(/^\/\*+/, "")
        .replace(/\*\/$/, "")
        .trim();
    return /^(?:[@#!]|eslint\b|oxlint\b|biome\b|prettier\b|tslint\b|stylelint\b|deno-lint\b|istanbul\b|c8\b|v8\b|flowlint\b|\$FlowFixMe\b|webpack\b|vite\b|rollup\b|noinspection\b|language=)/i.test(
        content,
    );
}

function commentKind(node: AstNode): "line" | "block" | null {
    if (node.type === "Line" || node.type === "LineComment") {
        return "line";
    }
    if (node.type === "Block" || node.type === "BlockComment") {
        return "block";
    }
    return null;
}

function key(node: AstNode): string {
    const [start, end] = rangeOf(node);
    return `${start}:${end}:${node.type}`;
}

export function sourceItems(sourceCode: SourceCode, program: AstNode): readonly SourceItem[] {
    const comments = sourceCode.getAllComments?.() ?? [];
    const commentKeys = new Set(comments.map(key));
    const tokens = sourceCode.getTokens?.(program, { includeComments: false }) ?? [];
    const byKey = new Map<string, Token>();
    for (const item of [...tokens, ...comments]) {
        byKey.set(key(item), item);
    }
    return [...byKey.values()]
        .sort((left, right) => rangeOf(left)[0] - rangeOf(right)[0])
        .map((node) => {
            const kind = commentKind(node);
            return {
                node,
                isComment: commentKeys.has(key(node)) || kind !== null,
                commentKind: kind,
            };
        });
}
