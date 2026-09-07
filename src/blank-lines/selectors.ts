import { asNode, isSingleLine, unwrapExport } from "./ast.ts";
import type { AstNode } from "./types.ts";

export type DeclarationKind =
    | "import"
    | "const"
    | "let"
    | "var"
    | "function"
    | "class"
    | "type"
    | "interface"
    | "enum"
    | "namespace";

export type StatementSelector =
    | "*"
    | "block"
    | "block-like"
    | "break"
    | "class"
    | "const"
    | "continue"
    | "debugger"
    | "directive"
    | "do"
    | "empty"
    | "enum"
    | "export"
    | "expression"
    | "for"
    | "function"
    | "if"
    | "import"
    | "interface"
    | "labeled"
    | "let"
    | "multiline"
    | "namespace"
    | "return"
    | "singleline"
    | "switch"
    | "throw"
    | "try"
    | "type"
    | "var"
    | "while"
    | "with";

export type ClassMemberSelector =
    | "*"
    | "abstract"
    | "accessor"
    | "constructor"
    | "declare"
    | "field"
    | "getter"
    | "index-signature"
    | "method"
    | "multiline"
    | "overload"
    | "setter"
    | "singleline"
    | "static"
    | "static-block";

export type TypeMemberSelector =
    | "*"
    | "call-signature"
    | "construct-signature"
    | "enum-member"
    | "getter"
    | "index-signature"
    | "method"
    | "multiline"
    | "overload"
    | "property"
    | "setter"
    | "singleline";

export function declarationKind(statement: AstNode): DeclarationKind | null {
    const node = unwrapExport(statement);
    switch (node.type) {
        case "ImportDeclaration":
        case "TSImportEqualsDeclaration":
            return "import";
        case "VariableDeclaration":
            return node.kind === "const" || node.kind === "let" || node.kind === "var"
                ? node.kind
                : null;
        case "FunctionDeclaration":
        case "TSDeclareFunction":
            return "function";
        case "ClassDeclaration":
            return "class";
        case "TSTypeAliasDeclaration":
            return "type";
        case "TSInterfaceDeclaration":
            return "interface";
        case "TSEnumDeclaration":
            return "enum";
        case "TSModuleDeclaration":
            return "namespace";
        default:
            return null;
    }
}

function isDirective(node: AstNode): boolean {
    if (node.type !== "ExpressionStatement") {
        return false;
    }
    if (typeof node.directive === "string") {
        return true;
    }
    const expression = asNode(node.expression);
    return expression?.type === "Literal" && typeof expression.value === "string";
}

function isBlockLike(node: AstNode): boolean {
    const actual = unwrapExport(node);
    return new Set([
        "BlockStatement",
        "IfStatement",
        "SwitchStatement",
        "TryStatement",
        "ForStatement",
        "ForInStatement",
        "ForOfStatement",
        "WhileStatement",
        "DoWhileStatement",
        "WithStatement",
        "FunctionDeclaration",
        "ClassDeclaration",
        "TSInterfaceDeclaration",
        "TSModuleDeclaration",
        "TSEnumDeclaration",
    ]).has(actual.type);
}

export function statementMatches(
    statement: AstNode,
    selector: StatementSelector,
    sourceText: string,
): boolean {
    const actual = unwrapExport(statement);
    switch (selector) {
        case "*":
            return true;
        case "singleline":
            return isSingleLine(statement, sourceText);
        case "multiline":
            return !isSingleLine(statement, sourceText);
        case "class":
        case "const":
        case "enum":
        case "function":
        case "import":
        case "interface":
        case "let":
        case "namespace":
        case "type":
        case "var":
            return declarationKind(statement) === selector;
        case "block":
            return actual.type === "BlockStatement";
        case "block-like":
            return isBlockLike(actual);
        case "break":
            return actual.type === "BreakStatement";
        case "continue":
            return actual.type === "ContinueStatement";
        case "debugger":
            return actual.type === "DebuggerStatement";
        case "directive":
            return isDirective(actual);
        case "do":
            return actual.type === "DoWhileStatement";
        case "empty":
            return actual.type === "EmptyStatement";
        case "export":
            return (
                statement.type === "ExportNamedDeclaration" ||
                statement.type === "ExportDefaultDeclaration"
            );
        case "expression":
            return actual.type === "ExpressionStatement";
        case "for":
            return (
                actual.type === "ForStatement" ||
                actual.type === "ForInStatement" ||
                actual.type === "ForOfStatement"
            );
        case "if":
            return actual.type === "IfStatement";
        case "labeled":
            return actual.type === "LabeledStatement";
        case "return":
            return actual.type === "ReturnStatement";
        case "switch":
            return actual.type === "SwitchStatement";
        case "throw":
            return actual.type === "ThrowStatement";
        case "try":
            return actual.type === "TryStatement";
        case "while":
            return actual.type === "WhileStatement";
        case "with":
            return actual.type === "WithStatement";
    }
}

function methodValue(member: AstNode): AstNode | null {
    return asNode(member.value);
}

export function isClassOverload(member: AstNode): boolean {
    if (member.type === "TSDeclareMethod") {
        return true;
    }
    if (member.type === "MethodDefinition" || member.type === "TSAbstractMethodDefinition") {
        const body = methodValue(member)?.body;
        return body === null || body === undefined;
    }
    return false;
}

export function classMemberMatches(
    member: AstNode,
    selector: ClassMemberSelector,
    sourceText: string,
): boolean {
    if (selector === "*") {
        return true;
    }
    if (selector === "singleline") {
        return isSingleLine(member, sourceText);
    }
    if (selector === "multiline") {
        return !isSingleLine(member, sourceText);
    }
    if (selector === "overload") {
        return isClassOverload(member);
    }
    if (selector === "static") {
        return member.static === true;
    }
    if (selector === "abstract") {
        return member.abstract === true || member.type.startsWith("TSAbstract");
    }
    if (selector === "declare") {
        return member.declare === true || member.type === "TSDeclareMethod";
    }

    switch (selector) {
        case "static-block":
            return member.type === "StaticBlock";
        case "index-signature":
            return member.type === "TSIndexSignature";
        case "field":
            return new Set([
                "PropertyDefinition",
                "AccessorProperty",
                "TSAbstractPropertyDefinition",
                "TSAbstractAccessorProperty",
            ]).has(member.type);
        case "method":
            return (
                new Set(["MethodDefinition", "TSAbstractMethodDefinition", "TSDeclareMethod"]).has(
                    member.type,
                ) &&
                member.kind !== "constructor" &&
                member.kind !== "get" &&
                member.kind !== "set"
            );
        case "constructor":
            return member.kind === "constructor";
        case "getter":
            return member.kind === "get";
        case "setter":
            return member.kind === "set";
        case "accessor":
            return (
                member.type === "AccessorProperty" || member.type === "TSAbstractAccessorProperty"
            );
        default:
            return false;
    }
}

export function isTypeOverload(member: AstNode): boolean {
    return new Set([
        "TSMethodSignature",
        "TSCallSignatureDeclaration",
        "TSConstructSignatureDeclaration",
        "TSGetterSignature",
        "TSSetterSignature",
    ]).has(member.type);
}

export function typeMemberMatches(
    member: AstNode,
    selector: TypeMemberSelector,
    sourceText: string,
): boolean {
    if (selector === "*") {
        return true;
    }
    if (selector === "singleline") {
        return isSingleLine(member, sourceText);
    }
    if (selector === "multiline") {
        return !isSingleLine(member, sourceText);
    }
    if (selector === "overload") {
        return isTypeOverload(member);
    }

    switch (selector) {
        case "property":
            return member.type === "TSPropertySignature";
        case "method":
            return (
                member.type === "TSMethodSignature" &&
                member.kind !== "get" &&
                member.kind !== "set"
            );
        case "call-signature":
            return member.type === "TSCallSignatureDeclaration";
        case "construct-signature":
            return member.type === "TSConstructSignatureDeclaration";
        case "index-signature":
            return member.type === "TSIndexSignature";
        case "getter":
            return (
                member.type === "TSGetterSignature" ||
                (member.type === "TSMethodSignature" && member.kind === "get")
            );
        case "setter":
            return (
                member.type === "TSSetterSignature" ||
                (member.type === "TSMethodSignature" && member.kind === "set")
            );
        case "enum-member":
            return member.type === "TSEnumMember";
        default:
            return false;
    }
}

export function anyStatementSelectorMatches(
    statement: AstNode,
    selectorOrSelectors: StatementSelector | readonly StatementSelector[],
    sourceText: string,
): boolean {
    const selectors: readonly StatementSelector[] =
        typeof selectorOrSelectors === "string" ? [selectorOrSelectors] : selectorOrSelectors;
    return selectors.some((selector) => statementMatches(statement, selector, sourceText));
}

export function anyClassSelectorMatches(
    member: AstNode,
    selectorOrSelectors: ClassMemberSelector | readonly ClassMemberSelector[],
    sourceText: string,
): boolean {
    const selectors: readonly ClassMemberSelector[] =
        typeof selectorOrSelectors === "string" ? [selectorOrSelectors] : selectorOrSelectors;
    return selectors.some((selector) => classMemberMatches(member, selector, sourceText));
}

export function anyTypeSelectorMatches(
    member: AstNode,
    selectorOrSelectors: TypeMemberSelector | readonly TypeMemberSelector[],
    sourceText: string,
): boolean {
    const selectors: readonly TypeMemberSelector[] =
        typeof selectorOrSelectors === "string" ? [selectorOrSelectors] : selectorOrSelectors;
    return selectors.some((selector) => typeMemberMatches(member, selector, sourceText));
}
