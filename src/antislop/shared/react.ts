import type { ESTree, Scope, SourceCode, Variable } from "@oxlint/plugins";

/** A function node that can contain executable JavaScript. */
export type RuntimeFunction = ESTree.ArrowFunctionExpression | ESTree.Function;

/** Return whether a node creates a runtime function boundary. */
export function isRuntimeFunction(node: ESTree.Node): node is RuntimeFunction {
    return (
        node.type === "ArrowFunctionExpression" ||
        node.type === "FunctionDeclaration" ||
        node.type === "FunctionExpression"
    );
}

/** Find the closest executable function containing a node. */
export function runtimeFunctionBoundary(node: ESTree.Node): RuntimeFunction | null {
    let current = node.parent;
    while (current !== null && current.type !== "Program") {
        if (isRuntimeFunction(current)) return current;
        current = current.parent;
    }
    return null;
}

/** Resolve either a reference or binding identifier through the lexical scope chain. */
export function resolveVariable(
    sourceCode: SourceCode,
    identifier: ESTree.IdentifierReference | ESTree.BindingIdentifier,
): Variable | null {
    let scope: Scope | null = sourceCode.getScope(identifier);
    while (scope !== null) {
        const variable = scope.set.get(identifier.name);
        if (variable !== undefined) return variable;
        scope = scope.upper;
    }
    return null;
}

/** Remove syntax-only wrappers around an expression. */
export function unwrapExpression(expression: ESTree.Expression): ESTree.Expression {
    let current = expression;
    while (
        current.type === "ParenthesizedExpression" ||
        current.type === "TSAsExpression" ||
        current.type === "TSSatisfiesExpression" ||
        current.type === "TSTypeAssertion" ||
        current.type === "TSNonNullExpression"
    ) {
        current = current.expression;
    }
    return current;
}

/** Read a statically named member property. */
export function staticMemberName(member: ESTree.MemberExpression): string | null {
    const property = member.property;
    if (!member.computed && property.type === "Identifier") return property.name;
    return member.computed && property.type === "Literal" && typeof property.value === "string"
        ? property.value
        : null;
}

function importedName(node: ESTree.Node): string | null {
    if (node.type !== "ImportSpecifier") return null;
    return node.imported.type === "Identifier" ? node.imported.name : node.imported.value;
}

function isNamedReactImport(variable: Variable, hookNames: ReadonlySet<string>): boolean {
    return variable.defs.some((definition) => {
        if (
            definition.type !== "ImportBinding" ||
            definition.parent?.type !== "ImportDeclaration" ||
            definition.parent.source.value !== "react"
        ) {
            return false;
        }
        const name = importedName(definition.node);
        return name !== null && hookNames.has(name);
    });
}

function isReactNamespace(
    sourceCode: SourceCode,
    identifier: ESTree.IdentifierReference,
): boolean {
    const variable = resolveVariable(sourceCode, identifier);
    if (variable === null) return identifier.name === "React";
    return variable.defs.some(
        (definition) =>
            definition.type === "ImportBinding" &&
            definition.parent?.type === "ImportDeclaration" &&
            definition.parent.source.value === "react" &&
            (definition.node.type === "ImportDefaultSpecifier" ||
                definition.node.type === "ImportNamespaceSpecifier"),
    );
}

/** Return whether a call resolves to one of the requested hooks exported by React. */
export function isReactHookCall(
    sourceCode: SourceCode,
    node: ESTree.CallExpression,
    hookNames: ReadonlySet<string>,
): boolean {
    const callee = node.callee;
    if (callee.type === "Identifier") {
        const variable = resolveVariable(sourceCode, callee);
        return variable !== null && isNamedReactImport(variable, hookNames);
    }
    if (callee.type !== "MemberExpression") return false;

    const hookName = staticMemberName(callee);
    if (hookName === null || !hookNames.has(hookName) || callee.object.type === "Super") {
        return false;
    }
    const object = unwrapExpression(callee.object);
    return object.type === "Identifier" && isReactNamespace(sourceCode, object);
}

/** Return whether an identifier is an unshadowed global with one of the requested names. */
export function isUnshadowedGlobal(
    sourceCode: SourceCode,
    identifier: ESTree.IdentifierReference,
    names: ReadonlySet<string>,
): boolean {
    if (!names.has(identifier.name)) return false;
    return sourceCode.isGlobalReference(identifier) || resolveVariable(sourceCode, identifier) === null;
}
