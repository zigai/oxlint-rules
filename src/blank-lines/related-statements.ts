import {
    asNode,
    collectPatternNames,
    isSingleLine,
    lineSpan,
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
import type { AstNode, SourceCode } from "./types.ts";

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

function isSmallValueDeclaration(node: AstNode): boolean {
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

export function usesDeclaredBindings(
    previous: AstNode,
    current: AstNode,
    sourceCode: SourceCode,
): boolean {
    return isSmallExpressionTree(current) && bindingsFeedRegions(previous, [current], sourceCode);
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

function relatedControlBoundary(
    previous: AstNode,
    current: AstNode,
    sourceCode: SourceCode,
): boolean {
    if (previous.type !== current.type) return false;
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
        declarationInitializesMutation(setup, operation, sourceCode) &&
        mutationFeedsRegions(operation, [argument], sourceCode)
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
                (statements.length === 2 &&
                    last.type === "ReturnStatement" &&
                    asNode(last.argument) === null &&
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

function conditionalMutation(statement: AstNode, sourceCode: SourceCode): AstNode | null {
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
        typeof asNode(nextGuard.argument)?.value === "boolean"
    )
        return true;
    // A tiny narrowing helper is one decision, not a guard phase and a work phase.
    const first = statements[0];
    const setup = statements[1];
    const result = statements[2];
    if (
        statements.length === 3 &&
        first !== undefined &&
        simpleGuard(first) !== null &&
        setup?.type === "VariableDeclaration" &&
        isSmallValueDeclaration(setup) &&
        result?.type === "ReturnStatement" &&
        isSimpleStatement(result) &&
        shareReadBinding(first, setup, sourceCode) &&
        bindingsFeedRegions(setup, [result], sourceCode)
    )
        return true;
    // Iterator exhaustion followed by consumption of that same iterator result.
    const before = statements[index - 2];
    if (
        guard !== null &&
        before?.type === "VariableDeclaration" &&
        ["ForStatement", "ForOfStatement", "WhileStatement"].includes(
            asNode(container.parent)?.type ?? "",
        ) &&
        isSimpleStatement(current) &&
        bindingsFeedRegions(before, [previous], sourceCode) &&
        bindingsFeedRegions(before, [current], sourceCode)
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
    return (
        body.length === 2 &&
        success !== undefined &&
        isScalarAccounting(success) &&
        exit?.type === "ReturnStatement" &&
        asNode(exit.argument) === null &&
        mutationPath(success, sourceCode) !== null &&
        mutationPath(current, sourceCode) !== null
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
    if (current.type === "ReturnStatement") {
        const argument = asNode(current.argument);
        const consequent = asNode(previous.consequent);
        const bodyStatements =
            consequent?.type === "BlockStatement" ? statementBody(consequent) : [consequent];
        const singleLineBody = bodyStatements.every(
            (stmt) => stmt !== null && stmt !== undefined && isSingleLine(stmt, sourceCode.text),
        );
        return (
            previous.type === "IfStatement" &&
            singleLineBody &&
            lineSpan(previous, sourceCode.text) <= 3 &&
            argument?.type === "Identifier" &&
            mutationFeedsRegions(left, [argument], sourceCode, true)
        );
    }
    if (right === null) return false;
    if (previous.type === "IfStatement" && current.type === "IfStatement") {
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
    for (const start of [index - 1, index - 2]) {
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

export function isPreflightSetup(statements: readonly AstNode[], sourceCode: SourceCode): boolean {
    const operation = statements[0];
    const setup = statements[1];
    const guard = statements[2];
    const owner = asNode(asNode(operation?.parent)?.parent);
    if (
        statements.length < 4 ||
        operation === undefined ||
        setup === undefined ||
        guard === undefined ||
        !["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(
            owner?.type ?? "",
        ) ||
        asNode(operation.expression)?.type !== "CallExpression" ||
        !isSimpleStatement(operation) ||
        !isSingleLineVariable(setup, sourceCode) ||
        !isSmallValueDeclaration(setup)
    )
        return false;
    const exit = simpleGuard(guard);
    const condition = asNode(guard.test);
    return (
        exit !== null &&
        asNode(exit.argument) === null &&
        condition !== null &&
        bindingsFeedRegions(setup, [condition], sourceCode)
    );
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
    return (
        (options.compactInitializations === true &&
            index === 1 &&
            isPreflightSetup(statements, sourceCode)) ||
        (options.compactWrappedDeclarations === true &&
            (returnedClosureBoundary(previous, current, sourceCode) ||
                cleanupCaptureBoundary(statements, index, sourceCode))) ||
        (options.compactShortBodies === true &&
            terminalAccountingBoundary(statements, index, sourceCode)) ||
        (options.compactShortBodies === true &&
            structuralExitBoundary(container, statements, index, sourceCode)) ||
        (options.compactRelatedControlFlow === true &&
            isSingleLineVariable(previous, sourceCode) &&
            deferredGuardBoundary(statements, index + 1, sourceCode)) ||
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
            relatedControlBoundary(previous, current, sourceCode)) ||
        (options.compactInitializations === true &&
            initializationBoundary(container, statements, index, sourceCode)) ||
        (options.compactConditionalUpdates === true &&
            mutationBoundary(statements, index, sourceCode))
    );
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
