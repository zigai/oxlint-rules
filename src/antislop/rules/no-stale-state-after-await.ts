import { defineRule } from "@oxlint/plugins";

import {
    isReactHookCall,
    resolveVariable,
    runtimeFunctionBoundary,
    unwrapExpression,
    type RuntimeFunction,
} from "../shared/react.ts";

import type { ESTree, Variable } from "@oxlint/plugins";

const stateHooks = new Set(["useState"]);

type StatePair = {
    readonly declaredAt: number;
    readonly owner: RuntimeFunction | null;
    readonly setterName: string;
    readonly state: Variable;
    readonly stateName: string;
};

function definiteAwaitPosition(expression: ESTree.Expression): number | null {
    const current = unwrapExpression(expression);
    switch (current.type) {
        case "AwaitExpression":
            return current.start;
        case "AssignmentExpression":
            return definiteAwaitPosition(current.right);
        case "BinaryExpression": {
            const left =
                current.left.type === "PrivateIdentifier"
                    ? null
                    : definiteAwaitPosition(current.left);
            return left ?? definiteAwaitPosition(current.right);
        }
        case "CallExpression": {
            if (
                current.callee.type !== "Super" &&
                current.callee.type !== "V8IntrinsicExpression"
            ) {
                const calleeAwait = definiteAwaitPosition(current.callee);
                if (calleeAwait !== null) return calleeAwait;
            }
            if (current.optional) return null;
            for (const argument of current.arguments) {
                const argumentAwait = definiteAwaitPosition(
                    argument.type === "SpreadElement" ? argument.argument : argument,
                );
                if (argumentAwait !== null) return argumentAwait;
            }
            return null;
        }
        case "ConditionalExpression": {
            const testAwait = definiteAwaitPosition(current.test);
            if (testAwait !== null) return testAwait;
            const consequentAwait = definiteAwaitPosition(current.consequent);
            const alternateAwait = definiteAwaitPosition(current.alternate);
            return consequentAwait === null || alternateAwait === null
                ? null
                : Math.min(consequentAwait, alternateAwait);
        }
        case "LogicalExpression":
            return definiteAwaitPosition(current.left);
        case "MemberExpression": {
            if (current.object.type !== "Super") {
                const objectAwait = definiteAwaitPosition(current.object);
                if (objectAwait !== null) return objectAwait;
            }
            if (
                current.optional ||
                !current.computed ||
                current.property.type === "PrivateIdentifier"
            ) {
                return null;
            }
            return definiteAwaitPosition(current.property);
        }
        case "NewExpression": {
            const calleeAwait = definiteAwaitPosition(current.callee);
            if (calleeAwait !== null) return calleeAwait;
            for (const argument of current.arguments) {
                const argumentAwait = definiteAwaitPosition(
                    argument.type === "SpreadElement" ? argument.argument : argument,
                );
                if (argumentAwait !== null) return argumentAwait;
            }
            return null;
        }
        case "SequenceExpression":
            for (const item of current.expressions) {
                const itemAwait = definiteAwaitPosition(item);
                if (itemAwait !== null) return itemAwait;
            }
            return null;
        case "TaggedTemplateExpression": {
            const tagAwait = definiteAwaitPosition(current.tag);
            if (tagAwait !== null) return tagAwait;
            for (const item of current.quasi.expressions) {
                const itemAwait = definiteAwaitPosition(item);
                if (itemAwait !== null) return itemAwait;
            }
            return null;
        }
        case "TemplateLiteral":
            for (const item of current.expressions) {
                const itemAwait = definiteAwaitPosition(item);
                if (itemAwait !== null) return itemAwait;
            }
            return null;
        case "UnaryExpression":
            return definiteAwaitPosition(current.argument);
        default:
            return null;
    }
}

function statementAwaitPosition(statement: ESTree.Statement): number | null {
    if (statement.type === "ExpressionStatement") {
        return definiteAwaitPosition(statement.expression);
    }
    if (statement.type !== "VariableDeclaration") return null;

    for (const declaration of statement.declarations) {
        if (declaration.init === null) continue;
        const position = definiteAwaitPosition(declaration.init);
        if (position !== null) return position;
    }
    return null;
}

function hasPriorDefiniteAwait(
    node: ESTree.Node,
    boundary: RuntimeFunction,
    minimumPosition: number,
): boolean {
    let current: ESTree.Node = node;
    while (current !== boundary) {
        const parent = current.parent;
        if (parent === null) return false;
        if (parent.type === "BlockStatement") {
            const index = parent.body.findIndex(
                (statement) => statement.start === current.start && statement.end === current.end,
            );
            if (index !== -1) {
                for (let statementIndex = 0; statementIndex < index; statementIndex += 1) {
                    const statement = parent.body[statementIndex];
                    if (statement === undefined) continue;
                    const awaitPosition = statementAwaitPosition(statement);
                    if (awaitPosition !== null && awaitPosition > minimumPosition) return true;
                }
            }
        }
        current = parent;
    }
    return false;
}

function argumentReadsState(argument: ESTree.Expression, state: Variable): boolean {
    return state.references.some(
        (reference) =>
            reference.identifier.start >= argument.start && reference.identifier.end <= argument.end,
    );
}

/** Reject React state updates that derive from a render snapshot after an await. */
export const noStaleStateAfterAwaitRule = defineRule({
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow useState setter arguments that read the captured state binding after an earlier guaranteed await in the same function.",
        },
        schema: [],
        messages: {
            staleState:
                "\"{{setter}}\" derives new state from the captured \"{{state}}\" snapshot after an await. Use the functional updater parameter so concurrent updates cannot overwrite one another.",
        },
    },
    createOnce(context) {
        const stateBySetter = new Map<Variable, StatePair>();
        const setterCalls: ESTree.CallExpression[] = [];

        const checkSetterCall = (node: ESTree.CallExpression) => {
            if (node.callee.type !== "Identifier") return;
            const setter = resolveVariable(context.sourceCode, node.callee);
            if (setter === null) return;
            const pair = stateBySetter.get(setter);
            if (pair === undefined) return;

            const [argument] = node.arguments;
            if (argument === undefined || argument.type === "SpreadElement") return;
            if (!argumentReadsState(argument, pair.state)) return;

            const boundary = runtimeFunctionBoundary(node);
            if (boundary === null) return;
            const minimumPosition = pair.owner === boundary ? pair.declaredAt : -1;
            if (!hasPriorDefiniteAwait(node, boundary, minimumPosition)) return;

            context.report({
                node,
                messageId: "staleState",
                data: { setter: pair.setterName, state: pair.stateName },
            });
        };

        return {
            VariableDeclarator(node) {
                if (
                    node.id.type !== "ArrayPattern" ||
                    node.init === null ||
                    node.parent.type !== "VariableDeclaration" ||
                    node.parent.kind !== "const"
                ) {
                    return;
                }
                const [stateIdentifier, setterIdentifier] = node.id.elements;
                if (
                    stateIdentifier?.type !== "Identifier" ||
                    setterIdentifier?.type !== "Identifier"
                ) {
                    return;
                }

                const initializer = unwrapExpression(node.init);
                if (
                    initializer.type !== "CallExpression" ||
                    !isReactHookCall(context.sourceCode, initializer, stateHooks)
                ) {
                    return;
                }

                const state = resolveVariable(context.sourceCode, stateIdentifier);
                const setter = resolveVariable(context.sourceCode, setterIdentifier);
                if (
                    state === null ||
                    setter === null ||
                    setter.references.some((reference) => reference.isWrite() && !reference.init)
                ) {
                    return;
                }
                stateBySetter.set(setter, {
                    declaredAt: node.end,
                    owner: runtimeFunctionBoundary(node),
                    setterName: setterIdentifier.name,
                    state,
                    stateName: stateIdentifier.name,
                });
            },
            CallExpression(node) {
                if (node.callee.type === "Identifier") setterCalls.push(node);
            },
            "Program:exit"() {
                for (const call of setterCalls) checkSetterCall(call);
            },
        };
    },
});
