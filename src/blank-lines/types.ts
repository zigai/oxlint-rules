export interface Position {
    readonly line: number;
    readonly column: number;
}

export interface SourceLocation {
    readonly start: Position;
    readonly end: Position;
}

export interface AstNode {
    readonly type: string;
    readonly range?: readonly [number, number];
    readonly start?: number;
    readonly end?: number;
    readonly loc?: SourceLocation;
    readonly [key: string]: unknown;
}

export interface Token extends AstNode {
    readonly value?: string;
}

export interface TextEdit {
    readonly range: readonly [number, number];
    readonly text: string;
}

export interface RuleFixer {
    replaceTextRange(range: readonly [number, number], text: string): TextEdit;
    insertTextBefore(node: AstNode, text: string): TextEdit;
    insertTextAfter(node: AstNode, text: string): TextEdit;
    removeRange(range: readonly [number, number]): TextEdit;
}

export interface TokenQueryOptions {
    readonly includeComments?: boolean;
    readonly skip?: number;
    readonly filter?: (token: Token) => boolean;
}

export interface SourceCode {
    readonly text: string;
    getScope(node: AstNode): Scope;
    getText(node?: AstNode, beforeCount?: number, afterCount?: number): string;
    getAllComments?(): readonly Token[];
    getTokens?(node: AstNode, options?: TokenQueryOptions): readonly Token[];
    getFirstToken?(node: AstNode, options?: TokenQueryOptions): Token | null;
    getLastToken?(node: AstNode, options?: TokenQueryOptions): Token | null;
    getTokenBefore?(node: AstNode, options?: TokenQueryOptions): Token | null;
    getTokenAfter?(node: AstNode, options?: TokenQueryOptions): Token | null;
    getLocFromIndex?(index: number): Position;
}

export interface Scope {
    readonly upper: Scope | null;
    readonly set: ReadonlyMap<string, ScopeVariable>;
}

export interface ScopeVariable {
    readonly references: readonly {
        readonly identifier: AstNode;
        isRead(): boolean;
        isWrite(): boolean;
    }[];
}

export interface ReportDescriptor {
    readonly node: AstNode;
    readonly messageId?: string;
    readonly message?: string;
    readonly data?: Readonly<Record<string, string | number>>;
    readonly fix?: (fixer: RuleFixer) => TextEdit | readonly TextEdit[] | null;
}

export interface RuleContext<Options extends readonly unknown[] = readonly unknown[]> {
    readonly options: Options;
    readonly sourceCode?: SourceCode;
    getSourceCode?(): SourceCode;
    report(descriptor: ReportDescriptor): void;
}

export type RuleListener = Readonly<Record<string, (node: AstNode) => void>>;

export interface RuleMeta {
    readonly type: "layout";
    readonly docs: {
        readonly description: string;
        readonly recommended?: boolean;
    };
    readonly fixable: "whitespace";
    readonly schema: readonly unknown[];
    readonly messages: Readonly<Record<string, string>>;
}

export interface RuleModule<Options extends readonly unknown[] = readonly unknown[]> {
    readonly meta: RuleMeta;
    create(context: RuleContext<Options>): RuleListener;
}

export interface Plugin {
    readonly meta: {
        readonly name: string;
        readonly version?: string;
    };
    readonly rules: Readonly<Record<string, unknown>>;
    readonly configs?: Readonly<Record<string, unknown>>;
}

export type BlankLinePolicy = "always" | "never" | "any";
