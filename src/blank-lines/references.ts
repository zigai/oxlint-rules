import { asNode, cuddleBindingNames, nodeArray, unwrapExport, walkAst } from "./ast.ts";
import { rangeOf } from "./spacing.ts";
import type { AstNode, Scope, ScopeVariable, SourceCode } from "./types.ts";

const EXECUTION_BOUNDARIES = new Set([
    "FunctionDeclaration",
    "FunctionExpression",
    "ArrowFunctionExpression",
    "ClassDeclaration",
    "ClassExpression",
]);

export function hasDeferredExecution(node: AstNode): boolean {
    let found = false;
    walkAst(node, (child) => {
        if (EXECUTION_BOUNDARIES.has(child.type)) found = true;
    });
    return found;
}

export function resolveBinding(
    node: AstNode,
    name: string,
    sourceCode: SourceCode,
): ScopeVariable | null {
    for (let scope: Scope | null = sourceCode.getScope(node); scope !== null; scope = scope.upper) {
        const variable = scope.set.get(name);
        if (variable !== undefined) return variable;
    }
    return null;
}

export function directlyReferences(
    node: AstNode,
    variable: ScopeVariable,
    access: "read" | "write" | "either" = "read",
): boolean {
    const [start, end] = rangeOf(node);
    const deferred: Array<readonly [number, number]> = [];
    walkAst(node, (child) => {
        if (EXECUTION_BOUNDARIES.has(child.type)) deferred.push(rangeOf(child));
    });
    return variable.references.some((reference) => {
        const [from, to] = rangeOf(reference.identifier);
        return (
            from >= start &&
            to <= end &&
            !deferred.some(([left, right]) => from >= left && to <= right) &&
            (access === "read"
                ? reference.isRead()
                : access === "write"
                  ? reference.isWrite()
                  : reference.isRead() || reference.isWrite())
        );
    });
}

export function shareReadBinding(left: AstNode, right: AstNode, sourceCode: SourceCode): boolean {
    let shared = false;
    walkAst(left, (node, parent, key) => {
        if (
            node.type !== "Identifier" ||
            typeof node.name !== "string" ||
            (key === "callee" && parent?.type === "CallExpression")
        )
            return;
        const binding = resolveBinding(node, node.name, sourceCode);
        // Implicit unwritten globals are not shared application state. Synthetic
        // function bindings and actual declarations retain their binding identity.
        if (
            binding?.defs?.length === 0 &&
            binding.scope.type === "global" &&
            !binding.references.some((reference) => reference.isWrite())
        )
            return;
        if (
            binding !== null &&
            directlyReferences(left, binding) &&
            directlyReferences(right, binding)
        )
            shared = true;
    });
    return shared;
}

export function bindingsFeedRegions(
    candidate: AstNode,
    regions: readonly AstNode[],
    sourceCode: SourceCode,
    includeAssignments = false,
    requireAll = true,
    access: "read" | "write" | "either" = "read",
): boolean {
    const names = cuddleBindingNames(candidate, includeAssignments);
    const bindings = [...names].map((name) => resolveBinding(candidate, name, sourceCode));
    // A destructuring discard is determined by references, not its spelling.
    const used = bindings.filter(
        (binding): binding is ScopeVariable =>
            binding !== null && binding.references.some((reference) => reference.isRead()),
    );
    if (used.length === 0) return false;
    const feeds = (binding: ScopeVariable): boolean =>
        regions.some((region) => directlyReferences(region, binding, access));
    return requireAll ? used.every(feeds) : used.some(feeds);
}

interface AccessPath {
    readonly root: ScopeVariable | AstNode;
    readonly properties: readonly (string | ScopeVariable)[];
}

function receiverOwner(node: AstNode): AstNode {
    let owner = node;
    for (let parent = asNode(node.parent); parent !== null; parent = asNode(parent.parent)) {
        owner = parent;
        if (
            parent.type === "FunctionDeclaration" ||
            parent.type === "FunctionExpression" ||
            parent.type === "ClassBody"
        )
            break;
    }
    return owner;
}

function accessPath(node: AstNode | null, sourceCode: SourceCode): AccessPath | null {
    if (node === null) return null;
    if (node.type === "Identifier" && typeof node.name === "string") {
        const root = resolveBinding(node, node.name, sourceCode);
        return root === null ? null : { root, properties: [] };
    }
    if (node.type === "ThisExpression") return { root: receiverOwner(node), properties: [] };
    if (node.type !== "MemberExpression" && node.type !== "OptionalMemberExpression") return null;
    const object = accessPath(asNode(node.object), sourceCode);
    const property = asNode(node.property);
    if (object === null || property === null) return null;
    let key: string | ScopeVariable | null = null;
    if (node.computed !== true && typeof property.name === "string") {
        key = (property.type === "PrivateIdentifier" ? "#" : "") + property.name;
    } else if (typeof property.value === "string" || typeof property.value === "number") {
        key = String(property.value);
    } else if (property.type === "Identifier" && typeof property.name === "string") {
        key = resolveBinding(property, property.name, sourceCode);
    }
    return key === null ? null : { root: object.root, properties: [...object.properties, key] };
}

function samePath(left: AccessPath, right: AccessPath): boolean {
    return (
        left.root === right.root &&
        left.properties.length === right.properties.length &&
        left.properties.every((property, index) => property === right.properties[index])
    );
}

export function callsUseSameTarget(left: AstNode, right: AstNode, sourceCode: SourceCode): boolean {
    const call = (statement: AstNode): AstNode | null => {
        let expression = asNode(statement.expression);
        if (expression?.type === "AwaitExpression") expression = asNode(expression.argument);
        return expression?.type === "CallExpression" && expression.optional !== true
            ? expression
            : null;
    };
    const first = call(left);
    const second = call(right);
    if (first === null || second === null) return false;
    const firstCallee = asNode(first.callee);
    const secondCallee = asNode(second.callee);
    if (
        firstCallee?.type !== "MemberExpression" ||
        secondCallee?.type !== "MemberExpression" ||
        firstCallee.optional === true ||
        secondCallee.optional === true ||
        accessPath(firstCallee, sourceCode) === null ||
        accessPath(secondCallee, sourceCode) === null
    )
        return false;
    const firstReceiver = accessPath(asNode(firstCallee.object), sourceCode);
    const secondReceiver = accessPath(asNode(secondCallee.object), sourceCode);
    if (
        firstReceiver === null ||
        secondReceiver === null ||
        !samePath(firstReceiver, secondReceiver)
    )
        return false;
    const firstArgs = nodeArray(first.arguments);
    const secondArgs = nodeArray(second.arguments);
    return (
        firstArgs.length > 0 &&
        firstArgs.length === secondArgs.length &&
        firstArgs.every((argument, index) => {
            const other = secondArgs[index];
            if (other === undefined) return false;
            const a = accessPath(argument, sourceCode);
            const b = accessPath(other, sourceCode);
            if (a !== null && b !== null) return samePath(a, b);
            return (
                argument.type === "Literal" &&
                other.type === "Literal" &&
                (argument.value === null ||
                    ["string", "number", "boolean"].includes(typeof argument.value)) &&
                argument.value === other.value
            );
        })
    );
}

export function mutationPath(statement: AstNode, sourceCode: SourceCode): AccessPath | null {
    const expression = asNode(statement.expression);
    if (statement.type !== "ExpressionStatement" || expression === null) return null;
    if (expression.type === "AssignmentExpression")
        return accessPath(asNode(expression.left), sourceCode);
    if (
        expression.type === "UpdateExpression" ||
        (expression.type === "UnaryExpression" && expression.operator === "delete")
    )
        return accessPath(asNode(expression.argument), sourceCode);
    return null;
}

export function mutationFeedsRegions(
    candidate: AstNode,
    regions: readonly AstNode[],
    sourceCode: SourceCode,
    includeReceiver = false,
): boolean {
    const target = mutationPath(candidate, sourceCode);
    if (target === null) return false;
    return regions.some((region) => {
        let found = false;
        const deferred: Array<readonly [number, number]> = [];
        walkAst(region, (node) => {
            if (EXECUTION_BOUNDARIES.has(node.type)) deferred.push(rangeOf(node));
            const [start, end] = rangeOf(node);
            if (deferred.some(([left, right]) => start >= left && end <= right)) return;
            const path = accessPath(node, sourceCode);
            if (
                path !== null &&
                (samePath(target, path) ||
                    (includeReceiver && path.root === target.root && path.properties.length === 0))
            )
                found = true;
        });
        return found;
    });
}

export function sameMutation(left: AstNode, right: AstNode, sourceCode: SourceCode): boolean {
    const a = mutationPath(left, sourceCode);
    const b = mutationPath(right, sourceCode);
    if (a === null || b === null || a.root !== b.root) return false;
    const leftReceiver = a.properties.slice(0, -1);
    const rightReceiver = b.properties.slice(0, -1);
    return (
        leftReceiver.length === rightReceiver.length &&
        leftReceiver.every((property, index) => property === rightReceiver[index])
    );
}

export function declarationInitializesMutation(
    declaration: AstNode,
    mutation: AstNode,
    sourceCode: SourceCode,
): boolean {
    const target = mutationPath(mutation, sourceCode);
    if (target === null || target.properties.length !== 0) return false;
    return nodeArray(unwrapExport(declaration).declarations).some((item) => {
        const id = asNode(item.id);
        return (
            id?.type === "Identifier" &&
            typeof id.name === "string" &&
            resolveBinding(id, id.name, sourceCode) === target.root
        );
    });
}
