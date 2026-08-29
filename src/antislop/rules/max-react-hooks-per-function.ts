import { defineRule } from "@oxlint/plugins";

import {
    resolveVariable,
    runtimeFunctionBoundary,
    staticMemberName,
    unwrapExpression,
    type RuntimeFunction,
} from "../shared/react.ts";

import type { ESTree, Variable } from "@oxlint/plugins";

const defaultMaximum = 20;

function isHookName(name: string): boolean {
    return name === "use" || /^use[A-Z0-9]/u.test(name);
}

function importedName(specifier: ESTree.ImportSpecifier): string {
    return specifier.imported.type === "Identifier"
        ? specifier.imported.name
        : String(specifier.imported.value);
}

/** Limit the number of direct React hook call sites owned by one runtime function. */
export const maxReactHooksPerFunctionRule = defineRule({
    meta: {
        type: "problem",
        docs: {
            description:
                "Limit direct React hook calls per function so components and custom hooks do not accumulate tightly coupled state and effects.",
        },
        schema: [
            {
                type: "object",
                properties: { max: { type: "integer", minimum: 1 } },
                additionalProperties: false,
            },
        ],
        defaultOptions: [{ max: defaultMaximum }],
        messages: {
            tooManyHooks:
                "This function owns more than {{max}} React hook call sites. Extract a cohesive component or custom hook instead of adding more interacting state and effects here.",
        },
    },
    createOnce(context) {
        const option = context.options?.[0];
        const maximum =
            typeof option === "object" &&
            option !== null &&
            !Array.isArray(option) &&
            typeof option.max === "number" &&
            Number.isSafeInteger(option.max) &&
            option.max >= 1
                ? option.max
                : defaultMaximum;
        const hookAliases = new Set<Variable>();
        const reactNamespaces = new Set<Variable>();
        const hookCounts = new Map<RuntimeFunction, number>();

        return {
            Program(node) {
                for (const statement of node.body) {
                    if (statement.type !== "ImportDeclaration") continue;
                    for (const specifier of statement.specifiers) {
                        const variable = resolveVariable(context.sourceCode, specifier.local);
                        if (variable === null) continue;
                        if (specifier.type === "ImportSpecifier") {
                            const name = importedName(specifier);
                            if (
                                isHookName(name) &&
                                (name !== "use" || statement.source.value === "react")
                            ) {
                                hookAliases.add(variable);
                            }
                        }
                        if (
                            statement.source.value === "react" &&
                            (specifier.type === "ImportDefaultSpecifier" ||
                                specifier.type === "ImportNamespaceSpecifier")
                        ) {
                            reactNamespaces.add(variable);
                        }
                    }
                }
            },
            CallExpression(node) {
                const boundary = runtimeFunctionBoundary(node);
                if (boundary === null) return;

                const callee = node.callee;
                let hookCall = false;
                if (callee.type === "Identifier") {
                    const variable = resolveVariable(context.sourceCode, callee);
                    hookCall =
                        (callee.name !== "use" && isHookName(callee.name)) ||
                        (variable !== null && hookAliases.has(variable));
                } else if (callee.type === "MemberExpression" && callee.object.type !== "Super") {
                    const memberName = staticMemberName(callee);
                    const object = unwrapExpression(callee.object);
                    if (
                        memberName !== null &&
                        isHookName(memberName) &&
                        object.type === "Identifier"
                    ) {
                        const variable = resolveVariable(context.sourceCode, object);
                        hookCall =
                            (variable !== null && reactNamespaces.has(variable)) ||
                            (variable === null && object.name === "React");
                    }
                }
                if (!hookCall) return;

                const previous = hookCounts.get(boundary) ?? 0;
                hookCounts.set(boundary, previous + 1);
                if (previous === maximum) {
                    context.report({
                        node,
                        messageId: "tooManyHooks",
                        data: { max: String(maximum) },
                    });
                }
            },
        };
    },
});
