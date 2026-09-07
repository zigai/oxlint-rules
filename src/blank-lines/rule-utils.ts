import { caseConsequent, statementBody } from "./ast.ts";
import { editForPolicy, getSourceCode, inspectGap, type GapInfo } from "./spacing.ts";
import type {
    AstNode,
    BlankLinePolicy,
    ReportDescriptor,
    RuleContext,
    RuleFixer,
    RuleListener,
    RuleModule,
    SourceCode,
    TextEdit,
} from "./types.ts";

interface PendingReport {
    readonly context: RuleContext;
    readonly descriptor: ReportDescriptor;
    readonly edit: TextEdit;
    readonly maximum: boolean;
}

interface LayoutReports {
    rules: number;
    readonly gaps: Map<number, PendingReport>;
}

const layoutReports = new WeakMap<SourceCode, LayoutReports>();
const layoutEdits = new WeakMap<
    NonNullable<ReportDescriptor["fix"]>,
    { readonly edit: TextEdit; readonly maximum: boolean }
>();

function queueReport(
    reports: LayoutReports,
    context: RuleContext,
    descriptor: ReportDescriptor,
): void {
    const layout = descriptor.fix === undefined ? undefined : layoutEdits.get(descriptor.fix);
    if (layout === undefined) {
        context.report(descriptor);
        return;
    }
    const { edit, maximum } = layout;
    const previous = reports.gaps.get(edit.range[1]);
    if (previous !== undefined) {
        // A gap's exact spacing owns its fix; a maximum only constrains gaps
        // without an exact policy. Identical policies need one diagnostic.
        if (maximum || previous.edit.text === edit.text) {
            return;
        }
        if (!previous.maximum) {
            // Conflicting explicit policies remain visible instead of silently
            // choosing one user's rule configuration over another.
            context.report(descriptor);
            return;
        }
    }
    reports.gaps.set(edit.range[1], { context, descriptor, edit, maximum });
}

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
        create(context) {
            const sourceCode = getSourceCode(context);
            let reports = layoutReports.get(sourceCode);
            if (reports === undefined) {
                reports = { rules: 0, gaps: new Map() };
                layoutReports.set(sourceCode, reports);
            }
            reports.rules += 1;
            const pending = reports;
            const listeners = create({
                options: context.options,
                sourceCode,
                report: (descriptor) => queueReport(pending, context, descriptor),
            });
            return {
                ...listeners,
                "Program:exit"(program) {
                    listeners["Program:exit"]?.(program);
                    pending.rules -= 1;
                    if (pending.rules !== 0) {
                        return;
                    }
                    layoutReports.delete(sourceCode);
                    for (const report of pending.gaps.values()) {
                        report.context.report(report.descriptor);
                    }
                },
            };
        },
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
    maximum = false,
): (fixer: {
    replaceTextRange(range: readonly [number, number], text: string): TextEdit;
}) => TextEdit {
    const fix = (fixer: Pick<RuleFixer, "replaceTextRange">): TextEdit =>
        fixer.replaceTextRange(edit.range, edit.text);
    layoutEdits.set(fix, { edit, maximum });
    return fix;
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
