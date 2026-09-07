import type { AstNode } from "./types.ts";
import { endOf, startOf } from "./spacing.ts";

const METADATA_KEYS = new Set([
    "type",
    "range",
    "start",
    "end",
    "loc",
    "parent",
    "tokens",
    "comments",
    "leadingComments",
    "trailingComments",
    "innerComments",
]);

export function isNode(value: unknown): value is AstNode {
    return typeof value === "object" && value !== null && "type" in value;
}

export function asNode(value: unknown): AstNode | null {
    return isNode(value) ? value : null;
}

export function nodeArray(value: unknown): readonly AstNode[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.map(asNode).filter((node): node is AstNode => node !== null);
}

export function statementBody(node: AstNode): readonly AstNode[] {
    return nodeArray(node.body);
}

export function switchCases(node: AstNode): readonly AstNode[] {
    return nodeArray(node.cases);
}

export function caseConsequent(node: AstNode): readonly AstNode[] {
    return nodeArray(node.consequent);
}

export function classMembers(node: AstNode): readonly AstNode[] {
    return nodeArray(node.body);
}

export function typeMembers(node: AstNode): readonly AstNode[] {
    return nodeArray(node.body ?? node.members);
}

export function unwrapExport(node: AstNode): AstNode {
    if (node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration") {
        return asNode(node.declaration) ?? node;
    }
    return node;
}

export function isSingleLine(node: AstNode, text?: string): boolean {
    if (node.loc !== undefined) {
        return node.loc.start.line === node.loc.end.line;
    }
    if (text === undefined) {
        return false;
    }
    return !/[\r\n]/.test(text.slice(startOf(node), endOf(node)));
}

export function walkAst(
    value: unknown,
    visit: (node: AstNode, parent: AstNode | null, key: string | null) => void,
    parent: AstNode | null = null,
    key: string | null = null,
): void {
    if (Array.isArray(value)) {
        for (const item of value) {
            walkAst(item, visit, parent, key);
        }
        return;
    }

    const node = asNode(value);
    if (node === null) {
        return;
    }
    visit(node, parent, key);

    for (const [childKey, child] of Object.entries(node)) {
        if (METADATA_KEYS.has(childKey)) {
            continue;
        }
        if (Array.isArray(child)) {
            for (const item of child) {
                walkAst(item, visit, node, childKey);
            }
        } else {
            walkAst(child, visit, node, childKey);
        }
    }
}

export function collectPatternNames(pattern: unknown, names = new Set<string>()): Set<string> {
    const node = asNode(pattern);
    if (node === null) {
        return names;
    }

    switch (node.type) {
        case "Identifier":
            if (typeof node.name === "string") {
                names.add(node.name);
            }
            break;
        case "RestElement":
            collectPatternNames(node.argument, names);
            break;
        case "AssignmentPattern":
            collectPatternNames(node.left, names);
            break;
        case "ArrayPattern":
            for (const element of Array.isArray(node.elements) ? node.elements : []) {
                collectPatternNames(element, names);
            }
            break;
        case "ObjectPattern":
            for (const propertyValue of Array.isArray(node.properties) ? node.properties : []) {
                const property = asNode(propertyValue);
                if (property === null) {
                    continue;
                }
                if (property.type === "RestElement") {
                    collectPatternNames(property.argument, names);
                } else {
                    collectPatternNames(property.value, names);
                }
            }
            break;
        case "TSParameterProperty":
            collectPatternNames(node.parameter, names);
            break;
        default:
            break;
    }
    return names;
}

export function cuddleBindingNames(statement: AstNode, includeAssignments: boolean): Set<string> {
    const node = unwrapExport(statement);
    const names = new Set<string>();

    if (node.type === "VariableDeclaration") {
        for (const declarationValue of Array.isArray(node.declarations) ? node.declarations : []) {
            const declaration = asNode(declarationValue);
            if (declaration !== null) {
                collectPatternNames(declaration.id, names);
            }
        }
        return names;
    }

    if (includeAssignments && node.type === "ExpressionStatement") {
        const expression = asNode(node.expression);
        if (expression?.type === "AssignmentExpression") {
            collectPatternNames(expression.left, names);
        }
    }

    return names;
}

const RUNTIME_TS_EXPRESSION_WRAPPERS = new Set([
    "TSAsExpression",
    "TSInstantiationExpression",
    "TSNonNullExpression",
    "TSSatisfiesExpression",
    "TSTypeAssertion",
]);

const TYPE_ONLY_CHILD_KEYS = new Set([
    "implements",
    "returnType",
    "superTypeArguments",
    "typeAnnotation",
    "typeArguments",
    "typeParameters",
]);

function isNonComputedName(parent: AstNode, key: string | null): boolean {
    if (parent.computed === true) {
        return false;
    }
    if (
        key === "property" &&
        (parent.type === "MemberExpression" || parent.type === "OptionalMemberExpression")
    ) {
        return true;
    }
    return (
        key === "key" &&
        new Set([
            "AccessorProperty",
            "MethodDefinition",
            "Property",
            "PropertyDefinition",
            "TSAbstractAccessorProperty",
            "TSAbstractMethodDefinition",
            "TSAbstractPropertyDefinition",
            "TSMethodSignature",
            "TSPropertySignature",
        ]).has(parent.type)
    );
}

function isBindingPosition(parent: AstNode, key: string | null): boolean {
    if (parent.type === "VariableDeclarator" && key === "id") {
        return true;
    }
    if (parent.type === "CatchClause" && key === "param") {
        return true;
    }
    if (
        key === "id" &&
        new Set([
            "ClassDeclaration",
            "ClassExpression",
            "FunctionDeclaration",
            "FunctionExpression",
            "TSDeclareFunction",
        ]).has(parent.type)
    ) {
        return true;
    }
    if (
        key === "params" &&
        new Set([
            "ArrowFunctionExpression",
            "FunctionDeclaration",
            "FunctionExpression",
            "TSDeclareFunction",
        ]).has(parent.type)
    ) {
        return true;
    }
    return false;
}

export function referencedIdentifiers(value: unknown): Set<string> {
    const names = new Set<string>();

    const visit = (
        child: unknown,
        parent: AstNode | null = null,
        key: string | null = null,
    ): void => {
        if (Array.isArray(child)) {
            for (const item of child) {
                visit(item, parent, key);
            }
            return;
        }

        const node = asNode(child);
        if (node === null) {
            return;
        }
        if (parent !== null && isBindingPosition(parent, key)) {
            return;
        }

        // Type syntax may contain identifiers that look like runtime references. For
        // expression wrappers, only the wrapped runtime expression is relevant.
        if (node.type.startsWith("TS")) {
            if (RUNTIME_TS_EXPRESSION_WRAPPERS.has(node.type)) {
                visit(node.expression, node, "expression");
            }
            return;
        }

        if (node.type === "Identifier" && typeof node.name === "string") {
            if (
                parent === null ||
                (!isNonComputedName(parent, key) &&
                    !isBindingPosition(parent, key) &&
                    key !== "label" &&
                    key !== "imported" &&
                    key !== "exported")
            ) {
                names.add(node.name);
            }
            return;
        }

        for (const [childKey, nested] of Object.entries(node)) {
            if (METADATA_KEYS.has(childKey) || TYPE_ONLY_CHILD_KEYS.has(childKey)) {
                continue;
            }
            visit(nested, node, childKey);
        }
    };

    visit(value);
    return names;
}

export function lineSpan(node: AstNode, text: string): number {
    if (node.loc !== undefined) {
        return node.loc.end.line - node.loc.start.line + 1;
    }
    const slice = text.slice(startOf(node), endOf(node));
    return (slice.match(/\r\n|\r|\n/g)?.length ?? 0) + 1;
}

export function isFunctionDeclaration(node: AstNode): boolean {
    const actual = unwrapExport(node);
    return actual.type === "FunctionDeclaration" || actual.type === "TSDeclareFunction";
}

export function functionName(node: AstNode): string | null {
    const actual = unwrapExport(node);
    const id = asNode(actual.id);
    return typeof id?.name === "string" ? id.name : null;
}

export function isFunctionOverloadSignature(node: AstNode): boolean {
    const actual = unwrapExport(node);
    if (actual.type === "TSDeclareFunction") {
        return true;
    }
    if (actual.type === "FunctionDeclaration") {
        return actual.body === null || actual.body === undefined;
    }
    return false;
}

export function areSameFunctionOverloads(previous: AstNode, current: AstNode): boolean {
    if (!isFunctionDeclaration(previous) || !isFunctionDeclaration(current)) {
        return false;
    }
    const prevName = functionName(previous);
    const currName = functionName(current);
    if (prevName === null || currName === null || prevName !== currName) {
        return false;
    }
    return isFunctionOverloadSignature(previous);
}
