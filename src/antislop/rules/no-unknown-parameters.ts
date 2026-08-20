import {
    defineRule,
    type ESTree,
    type Scope,
    type SourceCode,
    type Variable,
} from "@oxlint/plugins";

type Parameter = ESTree.ParamPattern;
type ParameterOwner =
    | ESTree.ArrowFunctionExpression
    | ESTree.Function
    | ESTree.TSCallSignatureDeclaration
    | ESTree.TSConstructSignatureDeclaration
    | ESTree.TSConstructorType
    | ESTree.TSFunctionType
    | ESTree.TSMethodSignature;

function parameterAnnotation(parameter: Parameter): ESTree.TSTypeAnnotation | null | undefined {
    if (parameter.type === "TSParameterProperty") {
        return parameterAnnotation(parameter.parameter);
    }
    if (parameter.type === "RestElement") {
        return parameter.typeAnnotation ?? parameterAnnotation(parameter.argument);
    }
    if (parameter.type === "AssignmentPattern") {
        return parameter.typeAnnotation ?? parameter.left.typeAnnotation;
    }
    return parameter.typeAnnotation;
}

function parameterIdentifier(parameter: Parameter): ESTree.BindingIdentifier | null {
    if (parameter.type === "TSParameterProperty") {
        return parameterIdentifier(parameter.parameter);
    }
    if (parameter.type === "AssignmentPattern") {
        return parameterIdentifier(parameter.left);
    }
    if (parameter.type === "RestElement") {
        return parameterIdentifier(parameter.argument);
    }
    return parameter.type === "Identifier" ? parameter : null;
}

function parameterName(parameter: Parameter, sourceText: string): string {
    return parameterIdentifier(parameter)?.name ?? sourceText.replace(/\s*:\s*unknown\s*$/u, "");
}

function resolveVariable(
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

function containsNode(ancestor: ESTree.Node, node: ESTree.Node): boolean {
    return ancestor.start <= node.start && ancestor.end >= node.end;
}

function callUsingReference(identifier: ESTree.Node): {
    readonly call: ESTree.CallExpression;
    readonly argumentIndex: number;
} | null {
    const parent = identifier.parent;
    if (parent?.type !== "CallExpression") return null;
    const argumentIndex = parent.arguments.findIndex((argument) => argument === identifier);
    return argumentIndex === -1 ? null : { call: parent, argumentIndex };
}

const concreteParserMethods = new Set(["decode", "parse", "safeDecode", "safeParse"]);

function isConcreteParserCall(call: ESTree.CallExpression): boolean {
    if (call.callee.type !== "MemberExpression" || call.callee.computed) return false;
    return (
        call.callee.property.type === "Identifier" &&
        concreteParserMethods.has(call.callee.property.name)
    );
}

function firstExecutableStatementContains(owner: ParameterOwner, identifier: ESTree.Node): boolean {
    if ("body" in owner && owner.body?.type === "BlockStatement") {
        const [firstStatement] = owner.body.body;
        return firstStatement !== undefined && containsNode(firstStatement, identifier);
    }
    return "body" in owner && owner.body !== null && containsNode(owner.body, identifier);
}

/** Disallow unknown inputs unless the function immediately parses them into a concrete type. */
export const noUnknownParametersRule = defineRule({
    meta: {
        type: "problem",
        docs: {
            description:
                "Disallow explicitly unknown function parameters except `cause` and parameters immediately passed to a concrete parser.",
        },
        schema: [],
        messages: {
            unknownParameter:
                "Parameter `{{parameter}}` leaves input unparsed. Accept a named domain type; run the expected schema or parser at the I/O boundary before calling this function.",
        },
    },
    create(context) {
        const functionsByName = new Map<string, ParameterOwner>();

        const isStructurallyRecognizedParserParameter = (
            owner: ParameterOwner,
            parameterIndex: number,
            visited = new Set<ParameterOwner>(),
        ): boolean => {
            if (
                visited.has(owner) ||
                owner.returnType === null ||
                owner.returnType === undefined ||
                owner.returnType.typeAnnotation.type === "TSTypePredicate"
            ) {
                return false;
            }
            const parameter = owner.params[parameterIndex];
            if (parameter === undefined) return false;
            const identifier = parameterIdentifier(parameter);
            if (identifier === null) return false;
            const variable = resolveVariable(context.sourceCode, identifier);
            if (variable === null) return false;
            const reads = variable.references.filter(
                (reference) => !reference.init && !reference.isWrite(),
            );
            if (reads.length !== 1) return false;
            const reference = reads[0]?.identifier;
            if (reference === undefined || !firstExecutableStatementContains(owner, reference)) {
                return false;
            }
            const use = callUsingReference(reference);
            if (use === null) return false;
            if (isConcreteParserCall(use.call)) return true;
            if (use.call.callee.type !== "Identifier") return false;
            const helper = functionsByName.get(use.call.callee.name);
            if (helper === undefined) return false;
            const nextVisited = new Set(visited);
            nextVisited.add(owner);
            return isStructurallyRecognizedParserParameter(helper, use.argumentIndex, nextVisited);
        };

        const checkParameters = (node: ParameterOwner) => {
            for (const [parameterIndex, parameter] of node.params.entries()) {
                const annotation = parameterAnnotation(parameter);
                if (annotation?.typeAnnotation.type !== "TSUnknownKeyword") continue;
                const name = parameterName(parameter, context.sourceCode.getText(parameter));
                if (
                    name === "cause" ||
                    isStructurallyRecognizedParserParameter(node, parameterIndex)
                ) {
                    continue;
                }
                context.report({
                    node: annotation.typeAnnotation,
                    messageId: "unknownParameter",
                    data: { parameter: name },
                });
            }
        };

        return {
            Program(node) {
                for (const statement of node.body) {
                    const declaration =
                        statement.type === "ExportNamedDeclaration"
                            ? statement.declaration
                            : statement;
                    if (declaration?.type === "FunctionDeclaration" && declaration.id !== null) {
                        functionsByName.set(declaration.id.name, declaration);
                    }
                }
            },
            ArrowFunctionExpression: checkParameters,
            FunctionDeclaration: checkParameters,
            FunctionExpression: checkParameters,
            TSCallSignatureDeclaration: checkParameters,
            TSConstructSignatureDeclaration: checkParameters,
            TSConstructorType: checkParameters,
            TSDeclareFunction: checkParameters,
            TSEmptyBodyFunctionExpression: checkParameters,
            TSFunctionType: checkParameters,
            TSMethodSignature: checkParameters,
        };
    },
});
