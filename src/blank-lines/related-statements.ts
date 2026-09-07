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
    hasDeferredExecution,
    mutationFeedsRegions,
    mutationPath,
    sameMutation,
    shareReadBinding,
    callsUseSameTarget,
} from "./references.ts";
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

function withinNodeBudget(node: AstNode): boolean {
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
            (statement.type === "ReturnStatement" || statement.type === "ThrowStatement")
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

function isShortBody(container: AstNode, statements: readonly AstNode[]): boolean {
    const last = statements.at(-1);
    return (
        container.type !== "Program" &&
        statements.length >= 2 &&
        statements.length <= 3 &&
        last !== undefined &&
        isExit(last) &&
        statements.every((statement) => isSimpleStatement(statement))
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
    if (
        previous.type === "IfStatement" &&
        current.type === "IfStatement" &&
        asNode(previous.consequent)?.type === "BlockStatement" &&
        asNode(current.consequent)?.type === "BlockStatement" &&
        (!isSingleLine(previous, sourceCode.text) || !isSingleLine(current, sourceCode.text))
    ) {
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
        (options.compactDestructuredSetup === true &&
            destructuredSetupBoundary(statements, index, sourceCode)) ||
        (options.compactTryFinally === true && tryFinallyBoundary(previous, current, sourceCode)) ||
        (options.compactShortBodies === true && isShortBody(container, statements)) ||
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
