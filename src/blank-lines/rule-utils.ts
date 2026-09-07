import { caseConsequent, statementBody } from "./ast.ts";
import { editForPolicy, getSourceCode, inspectGap, type GapInfo } from "./spacing.ts";
import type {
    AstNode,
    BlankLinePolicy,
    RuleContext,
    RuleListener,
    RuleModule,
    TextEdit,
} from "./types.ts";

export function createLayoutRule<Options extends readonly unknown[]>(
    description: string,
    schema: readonly unknown[],
    messages: Readonly<Record<string, string>>,
    create: (context: RuleContext<Options>) => RuleListener,
): RuleModule<Options> {
    return {
        meta: {
            type: "layout",
            docs: { description },
            fixable: "whitespace",
            schema,
            messages,
        },
        create,
    };
}

export function statementContainerVisitors(
    visit: (container: AstNode, statements: readonly AstNode[]) => void,
): RuleListener {
    const visitBody = (node: AstNode): void => visit(node, statementBody(node));
    return {
        Program: visitBody,
        BlockStatement: visitBody,
        StaticBlock: visitBody,
        TSModuleBlock: visitBody,
        SwitchCase(node): void {
            visit(node, caseConsequent(node));
        },
    };
}

export function editFix(
    edit: TextEdit,
): (fixer: {
    replaceTextRange(range: readonly [number, number], text: string): TextEdit;
}) => TextEdit {
    return (fixer) => fixer.replaceTextRange(edit.range, edit.text);
}

export function reportGapPolicy(
    context: RuleContext,
    left: AstNode,
    right: AstNode,
    policy: BlankLinePolicy,
    messageIds: { readonly always: string; readonly never: string },
    data?: Readonly<Record<string, string | number>>,
): boolean {
    if (policy === "any") {
        return false;
    }
    const sourceCode = getSourceCode(context);
    const edit = editForPolicy(sourceCode, left, right, policy);
    if (edit === null) {
        return false;
    }
    context.report({
        node: right,
        messageId: messageIds[policy],
        ...(data === undefined ? {} : { data }),
        fix: editFix(edit),
    });
    return true;
}

export function pureMultilineGap(
    context: RuleContext,
    left: AstNode,
    right: AstNode,
): GapInfo | null {
    const gap = inspectGap(getSourceCode(context), left, right);
    return gap.whitespaceOnly && gap.lineBreaks > 0 ? gap : null;
}

export function pairwise<T>(items: readonly T[]): readonly (readonly [T, T])[] {
    const pairs: Array<readonly [T, T]> = [];
    for (let index = 1; index < items.length; index += 1) {
        const left = items[index - 1];
        const right = items[index];
        if (left !== undefined && right !== undefined) {
            pairs.push([left, right]);
        }
    }
    return pairs;
}

export function firstOption<T extends object>(
    context: RuleContext<readonly [Partial<T>?]>,
    defaults: T,
): T {
    return { ...defaults, ...context.options[0] };
}
