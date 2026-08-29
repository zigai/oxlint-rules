import { defineRule } from "@oxlint/plugins";

import {
    isReactHookCall,
    isUnshadowedGlobal,
    runtimeFunctionBoundary,
    staticMemberName,
    unwrapExpression,
    type RuntimeFunction,
} from "../shared/react.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

const effectHooks = new Set(["useEffect", "useInsertionEffect", "useLayoutEffect"]);
const globalEventTargets = new Set(["document", "globalThis", "self", "window"]);
const intervalFunctions = new Set(["setInterval"]);
const intervalCleanupFunctions = new Set(["clearInterval"]);
const undefinedGlobals = new Set(["undefined"]);

type PersistentResource = {
    readonly kind: "event listener" | "interval";
    readonly node: ESTree.CallExpression;
};

type EffectState = {
    hasPossibleCleanup: boolean;
    readonly resources: PersistentResource[];
};

function rootIdentifier(expression: ESTree.Expression): ESTree.IdentifierReference | null {
    const current = unwrapExpression(expression);
    if (current.type === "Identifier") return current;
    if (current.type !== "MemberExpression" || current.object.type === "Super") return null;
    return rootIdentifier(current.object);
}

function isGlobalTarget(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
    const root = rootIdentifier(expression);
    return root !== null && isUnshadowedGlobal(sourceCode, root, globalEventTargets);
}

function propertyName(property: ESTree.Property): string | null {
    const key = property.key;
    if (!property.computed && key.type === "Identifier") return key.name;
    return key.type === "Literal" && typeof key.value === "string" ? key.value : null;
}

function listenerMayCleanItself(
    sourceCode: SourceCode,
    option: ESTree.Expression | ESTree.SpreadElement | undefined,
): boolean {
    if (option === undefined) return false;
    if (option.type === "SpreadElement") return true;
    const current = unwrapExpression(option);
    if (current.type === "Identifier") {
        return !isUnshadowedGlobal(sourceCode, current, undefinedGlobals);
    }
    if (current.type === "Literal") return false;
    if (current.type !== "ObjectExpression") return true;

    for (const property of current.properties) {
        if (property.type === "SpreadElement") return true;
        const name = propertyName(property);
        if (name === "signal") return true;
        if (name === "once") {
            return !(property.value.type === "Literal" && property.value.value === false);
        }
    }
    return false;
}

function isPersistentEventListener(
    sourceCode: SourceCode,
    node: ESTree.CallExpression,
): boolean {
    const callee = node.callee;
    if (
        callee.type !== "MemberExpression" ||
        callee.object.type === "Super" ||
        staticMemberName(callee) !== "addEventListener" ||
        !isGlobalTarget(sourceCode, callee.object)
    ) {
        return false;
    }
    return !listenerMayCleanItself(sourceCode, node.arguments[2]);
}

function isPersistentInterval(sourceCode: SourceCode, node: ESTree.CallExpression): boolean {
    const callee = node.callee;
    if (callee.type === "Identifier") {
        return isUnshadowedGlobal(sourceCode, callee, intervalFunctions);
    }
    return (
        callee.type === "MemberExpression" &&
        callee.object.type !== "Super" &&
        staticMemberName(callee) === "setInterval" &&
        isGlobalTarget(sourceCode, callee.object)
    );
}

function isPossibleDirectDisposal(sourceCode: SourceCode, node: ESTree.CallExpression): boolean {
    const callee = node.callee;
    if (callee.type === "Identifier") {
        return isUnshadowedGlobal(sourceCode, callee, intervalCleanupFunctions);
    }
    if (callee.type !== "MemberExpression" || callee.object.type === "Super") return false;
    const name = staticMemberName(callee);
    return (
        (name === "clearInterval" || name === "removeEventListener") &&
        isGlobalTarget(sourceCode, callee.object)
    );
}

function persistentResource(
    sourceCode: SourceCode,
    node: ESTree.CallExpression,
): PersistentResource | null {
    if (isPersistentEventListener(sourceCode, node)) return { kind: "event listener", node };
    if (isPersistentInterval(sourceCode, node)) return { kind: "interval", node };
    return null;
}

function couldReturnCleanup(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
    const current = unwrapExpression(expression);
    switch (current.type) {
        case "ArrowFunctionExpression":
        case "FunctionExpression":
        case "MemberExpression":
            return true;
        case "CallExpression":
            return persistentResource(sourceCode, current) === null;
        case "ConditionalExpression":
            return (
                couldReturnCleanup(sourceCode, current.consequent) ||
                couldReturnCleanup(sourceCode, current.alternate)
            );
        case "Identifier":
            return !isUnshadowedGlobal(sourceCode, current, undefinedGlobals);
        case "LogicalExpression":
            return (
                couldReturnCleanup(sourceCode, current.left) ||
                couldReturnCleanup(sourceCode, current.right)
            );
        case "SequenceExpression": {
            const last = current.expressions.at(-1);
            return last !== undefined && couldReturnCleanup(sourceCode, last);
        }
        default:
            return false;
    }
}

/** Require direct persistent resources created by React effects to have lifecycle cleanup. */
export const requireEffectCleanupRule = defineRule({
    meta: {
        type: "problem",
        docs: {
            description:
                "Require inline React effects that directly register global event listeners or intervals to expose or perform cleanup.",
        },
        schema: [],
        messages: {
            missingCleanup:
                "This effect creates a persistent {{resource}} but does not expose or perform possible cleanup.",
        },
    },
    createOnce(context) {
        const effects = new Map<RuntimeFunction, EffectState>();

        return {
            CallExpression(node) {
                if (isReactHookCall(context.sourceCode, node, effectHooks)) {
                    const [callback] = node.arguments;
                    if (
                        callback !== undefined &&
                        callback.type !== "SpreadElement" &&
                        (callback.type === "ArrowFunctionExpression" ||
                            callback.type === "FunctionExpression")
                    ) {
                        effects.set(callback, {
                            hasPossibleCleanup:
                                callback.body.type !== "BlockStatement" &&
                                couldReturnCleanup(context.sourceCode, callback.body),
                            resources: [],
                        });
                    }
                }

                const boundary = runtimeFunctionBoundary(node);
                if (boundary === null) return;
                const effect = effects.get(boundary);
                if (effect === undefined) return;
                if (isPossibleDirectDisposal(context.sourceCode, node)) {
                    effect.hasPossibleCleanup = true;
                }
                const resource = persistentResource(context.sourceCode, node);
                if (resource !== null) effect.resources.push(resource);
            },
            ReturnStatement(node) {
                const boundary = runtimeFunctionBoundary(node);
                if (boundary === null) return;
                const effect = effects.get(boundary);
                if (
                    effect !== undefined &&
                    node.argument !== null &&
                    couldReturnCleanup(context.sourceCode, node.argument)
                ) {
                    effect.hasPossibleCleanup = true;
                }
            },
            "Program:exit"() {
                for (const effect of effects.values()) {
                    if (effect.hasPossibleCleanup) continue;
                    for (const resource of effect.resources) {
                        context.report({
                            node: resource.node,
                            messageId: "missingCleanup",
                            data: { resource: resource.kind },
                        });
                    }
                }
            },
        };
    },
});
