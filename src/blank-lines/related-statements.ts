import {
    asNode,
    collectPatternNames,
    isSingleLine,
    nodeArray,
    statementBody,
    unwrapExport,
    walkAst,
} from "./ast.ts";
import {
    bindingsFeedRegions,
    declarationInitializesMutation,
    directlyReferences,
    hasDeferredExecution,
    mutationFeedsRegions,
    mutationPath,
    resolveBinding,
    sameMutation,
    shareReadBinding,
    callsUseSameTarget,
} from "./references.ts";
import { rangeOf } from "./spacing.ts";
import { declarationKind } from "./selectors.ts";
import type { AstNode, ScopeVariable, SourceCode } from "./types.ts";
export interface StatementGroupingOptions {
    readonly compactShortBodies?: boolean;
    readonly compactInitializations?: boolean;
    readonly compactConditionalUpdates?: boolean;
    readonly compactErrorHandlers?: boolean;
    readonly compactWrappedDeclarations?: boolean;
    readonly compactRelatedControlFlow?: boolean;
    readonly compactDestructuredSetup?: boolean;
    readonly compactTryFinally?: boolean;
}

export const statementGroupingDefaults: Required<StatementGroupingOptions> = {
    compactShortBodies: true,
    compactInitializations: true,
    compactConditionalUpdates: true,
    compactErrorHandlers: true,
    compactWrappedDeclarations: true,
    compactRelatedControlFlow: true,
    compactDestructuredSetup: true,
    compactTryFinally: true,
};

export const statementGroupingSchema = {
    compactShortBodies: { type: "boolean" },
    compactInitializations: { type: "boolean" },
    compactConditionalUpdates: { type: "boolean" },
    compactErrorHandlers: { type: "boolean" },
    compactWrappedDeclarations: { type: "boolean" },
    compactRelatedControlFlow: { type: "boolean" },
    compactDestructuredSetup: { type: "boolean" },
    compactTryFinally: { type: "boolean" },
} as const;

export function withinNodeBudget(node: AstNode): boolean {
    let size = 0;
    walkAst(node, () => {
        size += 1;
    });
    // An AST budget is stable when a formatter merely wraps a call or condition.
    return size <= 30;
}

function isSmallExpressionTree(node: AstNode): boolean {
    if (hasDeferredExecution(node)) return false;
    return withinNodeBudget(node);
}

export function isSmallValueDeclaration(node: AstNode): boolean {
    return (
        withinNodeBudget(node) &&
        nodeArray(unwrapExport(node).declarations).every((declaration) => {
            let initializer = asNode(declaration.init);
            if (initializer === null || !hasDeferredExecution(initializer)) return true;
            while (
                initializer?.type === "ChainExpression" ||
                initializer?.type === "AwaitExpression"
            ) {
                initializer = asNode(initializer.expression ?? initializer.argument);
            }
            // A call result can be used immediately even when producing it takes
            // a callback. A declaration of a closure or method object stays separate.
            return initializer?.type === "CallExpression";
        })
    );
}

export function isSingleLineVariable(node: AstNode, sourceCode: SourceCode): boolean {
    return unwrapExport(node).type === "VariableDeclaration" && isSingleLine(node, sourceCode.text);
}

// A declaration that selects between two constructed values reads its inputs
// either way; the node budget that guards other consumers does not decide it.
function conditionalInitializerDeclaration(statement: AstNode): boolean {
    const declaration = unwrapExport(statement);
    if (declaration.type !== "VariableDeclaration") return false;
    const declarations = nodeArray(declaration.declarations);
    if (declarations.length !== 1) return false;
    return asNode(declarations[0]?.init)?.type === "ConditionalExpression";
}

export function usesDeclaredBindings(
    previous: AstNode,
    current: AstNode,
    sourceCode: SourceCode,
): boolean {
    return (
        (isSmallExpressionTree(current) || conditionalInitializerDeclaration(current)) &&
        bindingsFeedRegions(previous, [current], sourceCode)
    );
}

export function initializesInTry(
    previous: AstNode,
    current: AstNode,
    sourceCode: SourceCode,
): boolean {
    if (current.type !== "TryStatement" || !isSingleLineVariable(previous, sourceCode))
        return false;
    const declarations = nodeArray(unwrapExport(previous).declarations);
    if (
        declarations.length === 0 ||
        declarations.some((declaration) => asNode(declaration.init) !== null)
    )
        return false;
    const block = asNode(current.block);
    const first = block === null ? undefined : statementBody(block)[0];
    return (
        first !== undefined &&
        bindingsFeedRegions(previous, [first], sourceCode, false, true, "write")
    );
}

function isSimpleStatement(node: AstNode): boolean {
    if (node.type === "VariableDeclaration") return isSmallValueDeclaration(node);
    if (
        !new Set([
            "VariableDeclaration",
            "ExpressionStatement",
            "ReturnStatement",
            "ThrowStatement",
            "BreakStatement",
            "ContinueStatement",
        ]).has(node.type)
    )
        return false;
    return isSmallExpressionTree(node);
}

function wrappedDeclarationBoundary(
    previous: AstNode,
    current: AstNode,
    sourceCode: SourceCode,
): boolean {
    return (
        unwrapExport(previous).type === "VariableDeclaration" &&
        !isSingleLine(previous, sourceCode.text) &&
        isSmallValueDeclaration(previous) &&
        (current.type === "ExpressionStatement" ||
            current.type === "ReturnStatement" ||
            current.type === "ThrowStatement") &&
        usesDeclaredBindings(previous, current, sourceCode)
    );
}

function smallControlHeader(node: AstNode): AstNode | null {
    if (!isSmallExpressionTree(node)) return null;
    const branch = asNode(node.type === "IfStatement" ? node.consequent : node.body);
    if (branch === null) return null;
    const body = branch.type === "BlockStatement" ? statementBody(branch) : [branch];
    const statement = body[0];
    if (body.length !== 1 || statement === undefined || !isSimpleStatement(statement)) return null;
    if (node.type === "IfStatement") {
        return asNode(node.alternate) === null &&
            (statement.type === "ReturnStatement" ||
                statement.type === "ThrowStatement" ||
                statement.type === "ExpressionStatement")
            ? asNode(node.test)
            : null;
    }
    if (
        !new Set(["WhileStatement", "ForStatement", "ForInStatement", "ForOfStatement"]).has(
            node.type,
        ) ||
        statement.type !== "ExpressionStatement"
    )
        return null;
    return asNode(node.test) ?? asNode(node.right);
}

// A conditional that reads as one visual unit: an unbraced consequent that fits
// on a single line, with no alternate branch. Adjacent multiline conditional
// operations are distinct phases even when they test and update shared state.
function isCompactConditionalBranch(node: AstNode, sourceCode: SourceCode): boolean {
    if (node.type !== "IfStatement" || asNode(node.alternate) !== null) return false;
    const consequent = asNode(node.consequent);
    return (
        consequent !== null &&
        consequent.type !== "BlockStatement" &&
        isSingleLine(consequent, sourceCode.text)
    );
}

function isEarlyExitConsequent(node: AstNode): boolean {
    if (node.type !== "IfStatement" || asNode(node.alternate) !== null) return false;
    const consequent = asNode(node.consequent);
    return consequent?.type === "ReturnStatement" || consequent?.type === "ThrowStatement";
}

// An update group continues only through single-line steps: once a step wraps
// onto several lines, the next boundary separates. Guard sequences (early
// exits) stay compact while every step reads as one unit.
function continuesCompactPair(
    previous: AstNode,
    current: AstNode,
    sourceCode: SourceCode,
): boolean {
    if (
        !isCompactConditionalBranch(previous, sourceCode) ||
        !isCompactConditionalBranch(current, sourceCode)
    )
        return false;
    return (
        isSingleLine(previous, sourceCode.text) ||
        (isEarlyExitConsequent(previous) && isEarlyExitConsequent(current))
    );
}

function relatedControlBoundary(
    previous: AstNode,
    current: AstNode,
    sourceCode: SourceCode,
): boolean {
    if (previous.type !== current.type) return false;
    if (previous.type === "IfStatement" && !continuesCompactPair(previous, current, sourceCode))
        return false;
    // Consecutive loops are independent traversal passes even when they read
    // the same state (forward/backward scans, delete/insert passes, head/tail
    // selection): they read as one unit only as compact single-line loops.
    if (
        LOOP_TYPES.has(previous.type) &&
        (!isSingleLine(previous, sourceCode.text) || !isSingleLine(current, sourceCode.text))
    ) {
        return false;
    }
    const left = smallControlHeader(previous);
    const right = smallControlHeader(current);
    return left !== null && right !== null && shareReadBinding(left, right, sourceCode);
}

function isExit(node: AstNode): boolean {
    return new Set([
        "ReturnStatement",
        "ThrowStatement",
        "BreakStatement",
        "ContinueStatement",
    ]).has(node.type);
}

function isSimpleConditionalOperation(node: AstNode): boolean {
    if (
        node.type !== "IfStatement" ||
        asNode(node.alternate) !== null ||
        !isSmallExpressionTree(node)
    )
        return false;
    const branch = asNode(node.consequent);
    const body = branch?.type === "BlockStatement" ? statementBody(branch) : [branch];
    const operation = body[0];
    return (
        body.length === 1 &&
        operation !== null &&
        operation !== undefined &&
        operation.type === "ExpressionStatement" &&
        isSimpleStatement(operation)
    );
}

function isPlainValue(node: AstNode | null): boolean {
    if (node === null) return false;
    if (node.type === "Identifier" || node.type === "Literal" || node.type === "ThisExpression")
        return true;
    if (node.type === "MemberExpression" || node.type === "OptionalMemberExpression") {
        const object = asNode(node.object);
        if (object === null || !isPlainValue(object)) return false;
        if (node.computed !== true) return true;
        return isPlainValue(asNode(node.property));
    }
    return false;
}

// Plain accumulation tallies a plain value: bare updates and plain
// assignments. Constructed values (nested calls, templates, object
// literals) are construction phases of their own.
function isPlainAccumulation(operation: AstNode): boolean {
    const expression = asNode(operation.expression);
    if (expression === null) return false;
    if (expression.type === "UpdateExpression") return true;
    if (expression.type === "AssignmentExpression") {
        return isPlainValue(asNode(expression.right));
    }
    return false;
}

function accumulatorReturnBoundary(
    statements: readonly AstNode[],
    index: number,
    sourceCode: SourceCode,
): boolean {
    const setup = statements[index - 2];
    const loop = statements[index - 1];
    const exit = statements[index];
    if (setup === undefined || loop === undefined || exit?.type !== "ReturnStatement") return false;
    if (!["ForStatement", "ForOfStatement", "ForInStatement", "WhileStatement"].includes(loop.type))
        return false;
    const argument = asNode(exit.argument);
    const body = asNode(loop.body);
    const operations = body?.type === "BlockStatement" ? statementBody(body) : [body];
    const operation = operations[0];
    return (
        argument?.type === "Identifier" &&
        operations.length === 1 &&
        operation !== null &&
        operation !== undefined &&
        isSimpleStatement(operation) &&
        isPlainAccumulation(operation) &&
        declarationInitializesMutation(setup, operation, sourceCode) &&
        mutationFeedsRegions(operation, [argument], sourceCode)
    );
}

const LOOP_TYPES: ReadonlySet<string> = new Set([
    "ForStatement",
    "ForInStatement",
    "ForOfStatement",
    "WhileStatement",
    "DoWhileStatement",
]);

function isPlainAppend(
    node: AstNode,
    method: string,
    returnedBinding: ScopeVariable,
    sourceCode: SourceCode,
): boolean {
    if (node.type !== "ExpressionStatement") return false;
    const expression = asNode(node.expression);
    if (expression?.type !== "CallExpression" || expression.optional === true) return false;
    const callee = asNode(expression.callee);
    const receiver = callee?.type === "MemberExpression" ? asNode(callee.object) : null;
    const property = asNode(callee?.property);
    return (
        receiver?.type === "Identifier" &&
        callee?.computed !== true &&
        callee?.optional !== true &&
        property?.type === "Identifier" &&
        property.name === method &&
        typeof receiver.name === "string" &&
        nodeArray(expression.arguments).length >= (method === "set" ? 2 : 1) &&
        nodeArray(expression.arguments).every((argument) => isPlainValue(asNode(argument))) &&
        resolveBinding(receiver, receiver.name, sourceCode) === returnedBinding
    );
}

// Nested loops contribute only plain accumulation of their own: extraction,
// derivation, and branching inside are grouping phases, not silent appends.
function nestedLoopAccumulatesPlainly(
    loop: AstNode,
    method: string,
    returnedBinding: ScopeVariable,
    sourceCode: SourceCode,
): boolean {
    const body = asNode(loop.body);
    const operations = body?.type === "BlockStatement" ? statementBody(body) : [body];
    return operations.every(
        (operation) =>
            operation !== null &&
            operation !== undefined &&
            (isPlainAppend(operation, method, returnedBinding, sourceCode) ||
                (LOOP_TYPES.has(operation.type) &&
                    nestedLoopAccumulatesPlainly(operation, method, returnedBinding, sourceCode))),
    );
}

function collectionAppendMethod(
    setup: AstNode,
    returned: AstNode,
    sourceCode: SourceCode,
): string | null {
    for (const declaration of nodeArray(setup.declarations)) {
        const id = asNode(declaration.id);
        const initializer = asNode(declaration.init);
        if (id?.type !== "Identifier" || typeof id.name !== "string" || initializer === null)
            continue;
        const binding = resolveBinding(id, id.name, sourceCode);
        if (binding === null || !directlyReferences(returned, binding)) continue;
        const [start, end] = rangeOf(id);
        // Reassignment loses the locally known collection identity.
        if (
            binding.references.some((reference) => {
                const [from, to] = rangeOf(reference.identifier);
                return reference.isWrite() && (from < start || to > end);
            })
        )
            return null;
        if (initializer.type === "ArrayExpression") return "push";
        const constructor = asNode(initializer.callee);
        if (
            initializer.type !== "NewExpression" ||
            constructor?.type !== "Identifier" ||
            (constructor.name !== "Map" && constructor.name !== "Set")
        )
            return null;
        const constructorBinding = resolveBinding(constructor, constructor.name, sourceCode);
        if (
            constructorBinding !== null &&
            (constructorBinding.defs?.length !== 0 ||
                constructorBinding.references.some((reference) => reference.isWrite()))
        )
            return null;
        return constructor.name === "Map" ? "set" : "add";
    }
    return null;
}

function collectionLoopBoundary(
    statements: readonly AstNode[],
    index: number,
    sourceCode: SourceCode,
): boolean {
    const loop = statements[index - 1];
    const current = statements[index];
    if (
        loop === undefined ||
        current === undefined ||
        !["ForStatement", "ForOfStatement", "ForInStatement", "WhileStatement"].includes(
            loop.type,
        ) ||
        hasDeferredExecution(loop)
    )
        return false;
    const returned = asNode(current.argument);
    if (
        current.type === "ReturnStatement" &&
        returned?.type === "Identifier" &&
        typeof returned.name === "string"
    ) {
        const returnedBinding = resolveBinding(returned, returned.name, sourceCode);
        if (returnedBinding === null) return false;
        const setup = statements
            .slice(0, index - 1)
            .find(
                (node) =>
                    node.type === "VariableDeclaration" &&
                    bindingsFeedRegions(node, [returned], sourceCode, false, false),
            );
        if (setup === undefined) return false;
        const method = collectionAppendMethod(setup, returned, sourceCode);
        if (method === null) return false;
        // Only plain accumulation keeps the result attached: extraction,
        // derivation, and branching inside the loop are grouping phases.
        if (!nestedLoopAccumulatesPlainly(loop, method, returnedBinding, sourceCode)) return false;
        let transfersControl = false;
        let accumulates = false;
        walkAst(loop, (node) => {
            // A transfer anywhere in the loop (including nested or labelled
            // targets) can filter work or terminate a building phase. Do not
            // infer unconditional accumulation across those paths.
            if (
                node.type === "ContinueStatement" ||
                node.type === "BreakStatement" ||
                node.type === "ReturnStatement" ||
                node.type === "ThrowStatement"
            )
                transfersControl = true;
            // Branch-specific accumulation is a decision tree with a completion
            // phase, unlike a direct collection loop (possibly nested in loops).
            for (
                let parent = asNode(node.parent);
                parent !== null && parent !== loop;
                parent = asNode(parent.parent)
            ) {
                if (
                    parent.type === "IfStatement" ||
                    parent.type === "ConditionalExpression" ||
                    parent.type === "LogicalExpression" ||
                    parent.type === "SwitchCase"
                )
                    return;
            }
            if (node.type !== "CallExpression") return;
            const callee = asNode(node.callee);
            const receiver = callee?.type === "MemberExpression" ? asNode(callee.object) : null;
            const property = asNode(callee?.property);
            if (
                receiver?.type === "Identifier" &&
                callee?.computed !== true &&
                callee?.optional !== true &&
                node.optional !== true &&
                property?.type === "Identifier" &&
                property.name === method &&
                nodeArray(node.arguments).length >= (method === "set" ? 2 : 1) &&
                typeof receiver.name === "string" &&
                resolveBinding(receiver, receiver.name, sourceCode) === returnedBinding
            )
                accumulates = true;
        });
        return accumulates && !transfersControl;
    }
    const expression = asNode(current.expression);
    const header = asNode(loop.right) ?? asNode(loop.test);
    // Iterating a receiver and then finalizing that same receiver is one phase.
    if (
        expression?.type === "CallExpression" &&
        nodeArray(expression.arguments).length === 0 &&
        header !== null &&
        shareReadBinding(header, current, sourceCode)
    )
        return true;
    // Per-iteration bookkeeping follows a nested collection loop only when its
    // source was derived from the same item and the bookkeeping feeds a guard.
    const setup = statements[index - 2];
    return (
        expression?.type === "AssignmentExpression" &&
        setup?.type === "VariableDeclaration" &&
        bindingsFeedRegions(setup, [loop], sourceCode) &&
        shareReadBinding(setup, current, sourceCode) &&
        statements
            .slice(0, index - 2)
            .some(
                (node) =>
                    node.type === "IfStatement" &&
                    mutationFeedsRegions(current, [node], sourceCode),
            )
    );
}

function isShortBody(container: AstNode, statements: readonly AstNode[]): boolean {
    const last = statements.at(-1);
    return (
        container.type !== "Program" &&
        statements.length >= 2 &&
        statements.length <= 3 &&
        last !== undefined &&
        isExit(last) &&
        statements.every(
            (statement) =>
                isSimpleStatement(statement) ||
                // A tiny helper stays whole at function scope; the same two
                // lines nested inside a larger block are separate steps.
                (statements.length === 2 &&
                    last.type === "ReturnStatement" &&
                    asNode(last.argument) === null &&
                    [
                        "FunctionDeclaration",
                        "FunctionExpression",
                        "ArrowFunctionExpression",
                    ].includes(asNode(container.parent)?.type ?? "") &&
                    isSimpleConditionalOperation(statement)),
        )
    );
}

function simpleGuard(node: AstNode): AstNode | null {
    if (node.type !== "IfStatement" || asNode(node.alternate) !== null) return null;
    const branch = asNode(node.consequent);
    const body = branch?.type === "BlockStatement" ? statementBody(branch) : [branch];
    const exit = body[0];
    return body.length === 1 && exit?.type === "ReturnStatement" && isSmallExpressionTree(node)
        ? exit
        : null;
}

export function conditionalMutation(statement: AstNode, sourceCode: SourceCode): AstNode | null {
    if (statement.type !== "IfStatement") return null;
    const mutations: AstNode[] = [];
    for (const branch of [asNode(statement.consequent), asNode(statement.alternate)]) {
        if (branch === null) continue;
        const body = branch.type === "BlockStatement" ? statementBody(branch) : [branch];
        if (body.length === 0 || body.length > 2) return null;
        for (const item of body) {
            if (!isSimpleStatement(item) || mutationPath(item, sourceCode) === null) return null;
            mutations.push(item);
        }
    }
    const first = mutations[0];
    return first !== undefined && mutations.every((item) => sameMutation(first, item, sourceCode))
        ? first
        : null;
}

function structuralExitBoundary(
    container: AstNode,
    statements: readonly AstNode[],
    index: number,
    sourceCode: SourceCode,
): boolean {
    const previous = statements[index - 1];
    const current = statements[index];
    if (previous === undefined || current === undefined || container.type === "Program")
        return false;
    const guard = simpleGuard(previous);
    const nextGuard = simpleGuard(current);
    if (
        guard !== null &&
        nextGuard !== null &&
        typeof asNode(guard.argument)?.value === "boolean" &&
        typeof asNode(nextGuard.argument)?.value === "boolean" &&
        isSingleLine(previous, sourceCode.text) &&
        isSingleLine(current, sourceCode.text)
    )
        return true;
    if (current.type !== "ReturnStatement") return false;
    if (
        guard !== null &&
        asNode(guard.argument)?.value === true &&
        statements.length === 3 &&
        statements[0]?.type === "VariableDeclaration" &&
        isSimpleStatement(current) &&
        bindingsFeedRegions(statements[0], [previous], sourceCode)
    )
        return true;
    if (asNode(current.argument) !== null) return false;
    // A bounded straight-line cleanup terminates as one group, even with several
    // receiver resets. Larger phases and callbacks still require separation.
    if (statements.length <= 6 && statements.every((node) => isSimpleStatement(node))) return true;
    // One nested cleanup conditional may contain only direct mutations. Calls,
    // deeper validation branches, and deferred work are separate cleanup phases.
    if (statements.length !== 2 || previous.type !== "IfStatement") return false;
    const branch = asNode(previous.consequent);
    const body = branch?.type === "BlockStatement" ? statementBody(branch) : [];
    return (
        asNode(previous.alternate) === null &&
        body.length <= 2 &&
        body.length > 0 &&
        body.every(
            (node) =>
                mutationPath(node, sourceCode) !== null ||
                conditionalMutation(node, sourceCode) !== null,
        )
    );
}

export function restorationBoundary(
    previous: AstNode,
    current: AstNode,
    sourceCode: SourceCode,
): boolean {
    if (previous.type !== "IfStatement" || asNode(previous.alternate) !== null) return false;
    const branch = asNode(previous.consequent);
    const body = branch?.type === "BlockStatement" ? statementBody(branch) : [];
    const deletion = body[0];
    const exit = body[1];
    const expression = asNode(deletion?.expression);
    const assignment = asNode(current.expression);
    const deletedPath = deletion === undefined ? null : mutationPath(deletion, sourceCode);
    const assignedPath = mutationPath(current, sourceCode);
    return (
        body.length === 2 &&
        deletion !== undefined &&
        expression?.type === "UnaryExpression" &&
        expression.operator === "delete" &&
        exit?.type === "ReturnStatement" &&
        asNode(exit.argument) === null &&
        assignment?.type === "AssignmentExpression" &&
        assignment.operator === "=" &&
        deletedPath !== null &&
        assignedPath !== null &&
        deletedPath.root === assignedPath.root &&
        deletedPath.properties.length === assignedPath.properties.length &&
        deletedPath.properties.every(
            (property, index) => property === assignedPath.properties[index],
        )
    );
}

export function returnedClosureBoundary(
    previous: AstNode,
    current: AstNode,
    sourceCode: SourceCode,
): boolean {
    if (
        !isSingleLineVariable(previous, sourceCode) ||
        !isSmallValueDeclaration(previous) ||
        current.type !== "ReturnStatement"
    )
        return false;
    const closure = asNode(current.argument);
    const body = asNode(closure?.body);
    if (nodeArray(previous.declarations).length !== 1) return false;
    const container = asNode(previous.parent);
    const statements = container === null ? [] : statementBody(container);
    // Walk only the adjacent declaration preparation group: unrelated locals
    // do not hide captures, but an earlier executable phase ends the group.
    for (let index = statements.indexOf(previous) - 1; index >= 0; index--) {
        const prior = statements[index];
        if (prior?.type !== "VariableDeclaration") break;
        if (body !== null && bindingsFeedRegions(prior, [body], sourceCode, false, false))
            return false;
    }
    return (
        (closure?.type === "ArrowFunctionExpression" || closure?.type === "FunctionExpression") &&
        body !== null &&
        bindingsFeedRegions(previous, [body], sourceCode)
    );
}

function isScalarAccounting(node: AstNode): boolean {
    const expression = asNode(node.expression);
    return (
        expression?.type === "AssignmentExpression" &&
        (expression.operator === "+=" || expression.operator === "-=") &&
        asNode(expression.left)?.type === "Identifier" &&
        typeof asNode(expression.right)?.value === "number"
    );
}

function cleanupCaptureBoundary(
    statements: readonly AstNode[],
    index: number,
    sourceCode: SourceCode,
): boolean {
    for (const start of [index - 1, index]) {
        const capture = statements[start];
        const operation = statements[start + 1];
        const cleanup = statements[start + 2];
        if (
            capture === undefined ||
            operation === undefined ||
            cleanup === undefined ||
            !returnedClosureBoundary(capture, cleanup, sourceCode) ||
            asNode(operation.expression)?.type !== "CallExpression" ||
            !isSimpleStatement(operation) ||
            !shareReadBinding(capture, operation, sourceCode)
        )
            continue;
        if (start === index - 1) return true;
        const accounting = statements[index - 1];
        if (accounting !== undefined && isScalarAccounting(accounting)) return true;
    }
    return false;
}
function isFunctionScoped(root: unknown): boolean {
    if (typeof root !== "object" || root === null || !("scope" in root)) return false;
    const scope = root.scope;
    if (typeof scope !== "object" || scope === null || !("type" in scope)) return false;
    return scope.type !== "module" && scope.type !== "global";
}

function terminalAccountingBoundary(
    statements: readonly AstNode[],
    index: number,
    sourceCode: SourceCode,
): boolean {
    const previous = statements[index - 1];
    const current = statements[index];
    if (
        index !== statements.length - 1 ||
        previous?.type !== "IfStatement" ||
        current === undefined ||
        !isScalarAccounting(current) ||
        asNode(previous.alternate) !== null
    )
        return false;
    const branch = asNode(previous.consequent);
    const body = branch?.type === "BlockStatement" ? statementBody(branch) : [];
    const success = body[0];
    const exit = body[1];
    // Tallies owned by the function stay with it; counters held in module
    // state are independent reporting units and separate.
    const successTarget = success === undefined ? null : mutationPath(success, sourceCode);
    const currentTarget = mutationPath(current, sourceCode);
    return (
        body.length === 2 &&
        success !== undefined &&
        isScalarAccounting(success) &&
        exit?.type === "ReturnStatement" &&
        asNode(exit.argument) === null &&
        successTarget !== null &&
        currentTarget !== null &&
        isFunctionScoped(successTarget.root) &&
        isFunctionScoped(currentTarget.root)
    );
}

function isInitialization(statement: AstNode, sourceCode: SourceCode): boolean {
    const expression = asNode(statement.expression);
    return (
        isSimpleStatement(statement) &&
        (isSingleLineVariable(statement, sourceCode) ||
            expression?.type === "AssignmentExpression" ||
            expression?.type === "UpdateExpression")
    );
}

function initializationBoundary(
    container: AstNode,
    statements: readonly AstNode[],
    index: number,
    sourceCode: SourceCode,
): boolean {
    if (container.type === "Program" || index === 0) return false;
    const prefix: AstNode[] = [];
    for (const statement of statements) {
        if (!isInitialization(statement, sourceCode)) break;
        prefix.push(statement);
        if (prefix.length > 3) break;
    }
    return (
        prefix.length >= 2 &&
        prefix.length <= 3 &&
        index < prefix.length &&
        prefix[0] !== undefined &&
        isSingleLineVariable(prefix[0], sourceCode)
    );
}

export function conditionalUpdateBoundary(
    previous: AstNode,
    current: AstNode,
    sourceCode: SourceCode,
): boolean {
    const left =
        conditionalMutation(previous, sourceCode) ??
        (isSimpleStatement(previous) ? previous : null);
    const right =
        conditionalMutation(current, sourceCode) ?? (isSimpleStatement(current) ? current : null);
    if (left === null) return false;
    if (right === null) return false;
    if (previous.type === "IfStatement" && current.type === "IfStatement") {
        if (!continuesCompactPair(previous, current, sourceCode)) return false;
        const firstTest = asNode(previous.test);
        const secondTest = asNode(current.test);
        if (
            firstTest === null ||
            secondTest === null ||
            !shareReadBinding(firstTest, secondTest, sourceCode)
        )
            return false;
    }
    return (
        (previous.type === "IfStatement" || current.type === "IfStatement") &&
        (sameMutation(left, right, sourceCode) ||
            declarationInitializesMutation(left, right, sourceCode))
    );
}

function mutationBoundary(
    statements: readonly AstNode[],
    index: number,
    sourceCode: SourceCode,
): boolean {
    const previous = statements[index - 1];
    const current = statements[index];
    if (previous === undefined || current === undefined) return false;
    // A result after a sequence of conditional updates is a separate completion
    // phase, rather than the tail of just the last update.
    const beforePrevious = statements[index - 2];
    if (
        current.type === "ReturnStatement" &&
        beforePrevious !== undefined &&
        conditionalMutation(beforePrevious, sourceCode) !== null &&
        conditionalMutation(previous, sourceCode) !== null
    )
        return false;
    if (conditionalUpdateBoundary(previous, current, sourceCode)) return true;
    // Keep short setup for the next update in the same object-construction group.
    if (!isSingleLineVariable(current, sourceCode)) return false;
    const next = statements[index + 1];
    return (
        next !== undefined &&
        usesDeclaredBindings(current, next, sourceCode) &&
        conditionalUpdateBoundary(previous, next, sourceCode)
    );
}

function destructuredSetupBoundary(
    statements: readonly AstNode[],
    index: number,
    sourceCode: SourceCode,
): boolean {
    // Bind multiple outputs, account for one, then initialize a collection that
    // the immediately following consumer fills using the remaining outputs.
    // Only the declaration-to-update pair compacts for object patterns: the
    // accounting step ends its phase before the collection setup begins.
    // Positional tuple outputs keep the whole run together.
    const starts = [index - 1];
    const earlier = statements[index - 2];
    if (earlier !== undefined) {
        const pattern = asNode(nodeArray(unwrapExport(earlier).declarations)[0]?.id);
        if (pattern?.type === "ArrayPattern") starts.push(index - 2);
    }
    for (const start of starts) {
        const declaration = statements[start];
        const update = statements[start + 1];
        const setup = statements[start + 2];
        const consumer = statements[start + 3];
        if (
            declaration === undefined ||
            update === undefined ||
            setup === undefined ||
            consumer === undefined
        )
            continue;
        if (declaration.type !== "VariableDeclaration" || !isSmallValueDeclaration(declaration))
            continue;
        const declarators = nodeArray(declaration.declarations);
        const pattern = asNode(declarators[0]?.id);
        if (
            declarators.length !== 1 ||
            pattern === null ||
            !["ObjectPattern", "ArrayPattern"].includes(pattern.type) ||
            collectPatternNames(pattern).size < 2
        )
            continue;
        if (
            !isSmallExpressionTree(update) ||
            mutationPath(update, sourceCode) === null ||
            setup.type !== "VariableDeclaration" ||
            !isSmallValueDeclaration(setup) ||
            !["ForStatement", "ForOfStatement", "ForInStatement", "WhileStatement"].includes(
                consumer.type,
            ) ||
            hasDeferredExecution(consumer)
        )
            continue;
        if (
            bindingsFeedRegions(declaration, [update], sourceCode, false, false) &&
            bindingsFeedRegions(declaration, [update, consumer], sourceCode) &&
            bindingsFeedRegions(setup, [consumer], sourceCode)
        )
            return true;
    }
    return false;
}

function tryFinallyBoundary(previous: AstNode, current: AstNode, sourceCode: SourceCode): boolean {
    if (
        current.type !== "TryStatement" ||
        previous.type !== "ExpressionStatement" ||
        !isSmallExpressionTree(previous)
    )
        return false;
    const finalizer = asNode(current.finalizer);
    const cleanup = finalizer === null ? [] : statementBody(finalizer);
    const operation = cleanup[0];
    return (
        cleanup.length === 1 &&
        operation !== undefined &&
        isSmallExpressionTree(operation) &&
        callsUseSameTarget(previous, operation, sourceCode)
    );
}

export function deferredGuardBoundary(
    statements: readonly AstNode[],
    index: number,
    sourceCode: SourceCode,
): boolean {
    const operation = statements[index - 1];
    const control = statements[index];
    const condition = control?.type === "IfStatement" ? asNode(control.test) : null;
    const expression =
        operation?.type === "ExpressionStatement" ? asNode(operation.expression) : null;
    if (
        operation === undefined ||
        condition === null ||
        expression?.type !== "CallExpression" ||
        !isSimpleStatement(operation)
    )
        return false;
    // A captured value can survive one conditional side effect before the call.
    // Updates are not calls: advancing an index starts a separate decision phase.
    for (let offset = index - 2; offset >= Math.max(0, index - 3); offset -= 1) {
        const setup = statements[offset];
        if (setup === undefined) return false;
        if (isSingleLineVariable(setup, sourceCode))
            return bindingsFeedRegions(setup, [condition], sourceCode);
        if (!isSimpleConditionalOperation(setup)) return false;
    }
    return false;
}

export function compactStatementBoundary(
    container: AstNode,
    statements: readonly AstNode[],
    index: number,
    sourceCode: SourceCode,
    options: StatementGroupingOptions,
): boolean {
    const previous = statements[index - 1];
    const current = statements[index];
    if (previous === undefined || current === undefined) return false;
    if (startsDeclarationPhase(previous, current, sourceCode)) return false;
    // A multiline loop body is a phase of its own: the statement after it starts
    // a new phase (165 corpus instances separate, none cuddle).
    if (LOOP_TYPES.has(previous.type) && !isSingleLine(previous, sourceCode.text)) {
        return false;
    }
    // A bare `return;` that closes the container after a multiline step is its
    // own line (13 of 13 corpus instances separate).
    if (
        current.type === "ReturnStatement" &&
        asNode(current.argument) === null &&
        !isSingleLine(previous, sourceCode.text)
    ) {
        return false;
    }
    // A guard completes a step: the next write to the state it inspected starts
    // a new one (24 of 24 corpus instances separate).
    if (
        previous.type === "IfStatement" &&
        mutationFeedsRegions(previous, [current], sourceCode, true)
    ) {
        return false;
    }
    return (
        (options.compactWrappedDeclarations === true &&
            (returnedClosureBoundary(previous, current, sourceCode) ||
                cleanupCaptureBoundary(statements, index, sourceCode))) ||
        (options.compactShortBodies === true &&
            terminalAccountingBoundary(statements, index, sourceCode)) ||
        (options.compactShortBodies === true &&
            structuralExitBoundary(container, statements, index, sourceCode)) ||
        (options.compactDestructuredSetup === true &&
            destructuredSetupBoundary(statements, index, sourceCode)) ||
        (options.compactTryFinally === true && tryFinallyBoundary(previous, current, sourceCode)) ||
        (options.compactShortBodies === true && isShortBody(container, statements)) ||
        (options.compactShortBodies === true &&
            accumulatorReturnBoundary(statements, index, sourceCode)) ||
        (options.compactShortBodies === true &&
            collectionLoopBoundary(statements, index, sourceCode)) ||
        (options.compactErrorHandlers === true &&
            asNode(container.parent)?.type === "CatchClause" &&
            statements.at(-1)?.type === "ThrowStatement" &&
            isShortBody(container, statements)) ||
        (options.compactWrappedDeclarations === true &&
            wrappedDeclarationBoundary(previous, current, sourceCode)) ||
        (options.compactRelatedControlFlow === true &&
            isSingleLineVariable(previous, sourceCode) &&
            deferredGuardBoundary(statements, index + 1, sourceCode)) ||
        (options.compactRelatedControlFlow === true &&
            relatedControlBoundary(previous, current, sourceCode)) ||
        (options.compactInitializations === true &&
            initializationBoundary(container, statements, index, sourceCode)) ||
        (options.compactWrappedDeclarations === true &&
            compactValueAliasStep(previous, current, sourceCode)) ||
        (options.compactConditionalUpdates === true &&
            mutationBoundary(statements, index, sourceCode))
    );
}

// A completed step and a following declaration start separate phases: the
// declaration derives or captures state of its own. The exception is a
// declaration that consumes what the step just wrote (a receiver reset
// followed by a read of that receiver).
export function startsDeclarationPhase(
    previous: AstNode,
    current: AstNode,
    sourceCode: SourceCode,
): boolean {
    if (previous.type !== "ExpressionStatement") return false;
    if (declarationKind(current) === null) return false;
    const expression = asNode(previous.expression);
    const completedStep =
        expression?.type === "CallExpression" ||
        (expression?.type === "AssignmentExpression" && expression.operator === "=");
    return (
        completedStep &&
        isSingleLine(previous, sourceCode.text) &&
        !mutationFeedsRegions(previous, [unwrapExport(current)], sourceCode, true)
    );
}

// A single-line declaration that names a value and the single-line statement
// that follows it are one step: the local alias feeds the next line. Corpus
// evidence: 74 of 74 such boundaries stay compact (48 member-access aliases and
// 26 name bindings), with no separated instance.
export function compactValueAliasStep(
    previous: AstNode,
    current: AstNode,
    sourceCode: SourceCode,
): boolean {
    if (!isSingleLine(previous, sourceCode.text) || !isSingleLine(current, sourceCode.text)) {
        return false;
    }
    const declaration = unwrapExport(previous);
    if (declaration.type !== "VariableDeclaration") return false;
    const declarations = nodeArray(declaration.declarations);
    if (declarations.length !== 1) return false;
    const initializer = asNode(declarations[0]?.init);
    if (initializer === null) return false;
    if (
        !new Set([
            "Identifier",
            "MemberExpression",
            "PropertyAccessExpression",
            "ElementAccessExpression",
        ]).has(initializer.type)
    ) {
        return false;
    }
    return current.type === "ExpressionStatement";
}

export function isCompactExitPredecessor(
    previous: AstNode,
    current: AstNode,
    sourceCode: SourceCode,
): boolean {
    if (!isSingleLine(previous, sourceCode.text)) return false;
    if (isSingleLineVariable(previous, sourceCode))
        return usesDeclaredBindings(previous, current, sourceCode);
    if (previous.type !== "ExpressionStatement" || !isSmallExpressionTree(current)) return false;
    const expression = asNode(previous.expression);
    return expression?.type === "AssignmentExpression" || expression?.type === "UpdateExpression";
}
