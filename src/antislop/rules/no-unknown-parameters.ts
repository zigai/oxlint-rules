import {
    defineRule,
    type ESTree,
    type Reference,
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

const concreteParserMethods = new Set(["Parse", "decode", "parse", "safeDecode", "safeParse"]);
const valibotParserFunctions = new Map([
    ["parse", 1],
    ["safeParse", 1],
]);

type ImportedParserFunction = {
    readonly argumentIndex: number;
    readonly variable: Variable;
};

function sourceKeyName(sourceCode: SourceCode, key: ESTree.PropertyKey): string {
    if (key.type === "Identifier" || key.type === "PrivateIdentifier") return key.name;
    if (key.type === "Literal") return String(key.value);
    return sourceCode.getText(key);
}

function parserDeclarationName(owner: ParameterOwner, sourceCode: SourceCode): string | null {
    if (owner.type === "TSMethodSignature") return sourceKeyName(sourceCode, owner.key);
    if (owner.type === "TSDeclareFunction") return owner.id?.name ?? null;
    if (owner.type === "TSFunctionType") {
        let parent: ESTree.Node | null = owner.parent;
        while (parent !== null && parent.type !== "TSPropertySignature") {
            if (parent.type === "Program" || parent.type === "TSInterfaceBody") return null;
            parent = parent.parent;
        }
        return parent === null ? null : sourceKeyName(sourceCode, parent.key);
    }
    const parent = owner.parent;
    if (parent?.type === "Property" && parent.value === owner) {
        return sourceKeyName(sourceCode, parent.key);
    }
    if (parent?.type === "MethodDefinition" && parent.value === owner) {
        return sourceKeyName(sourceCode, parent.key);
    }
    return null;
}

function isConcreteParserDeclarationParameter(
    owner: ParameterOwner,
    parameterIndex: number,
    sourceCode: SourceCode,
): boolean {
    const name = parserDeclarationName(owner, sourceCode);
    return (
        parameterIndex === 0 &&
        owner.returnType !== null &&
        owner.returnType !== undefined &&
        !isTypeGuard(owner) &&
        name !== null &&
        concreteParserMethods.has(name)
    );
}

function isConcreteParserMethodCall(call: ESTree.CallExpression): boolean {
    if (call.callee.type !== "MemberExpression" || call.callee.computed) return false;
    return (
        call.callee.property.type === "Identifier" &&
        concreteParserMethods.has(call.callee.property.name)
    );
}

function isTypeGuard(owner: ParameterOwner): boolean {
    return owner.returnType?.typeAnnotation.type === "TSTypePredicate";
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
        schema: [
            {
                type: "object",
                properties: {
                    allowInTypeGuards: { type: "boolean" },
                },
                additionalProperties: false,
            },
        ],
        defaultOptions: [{ allowInTypeGuards: false }],
        messages: {
            unknownParameter:
                "Parameter `{{parameter}}` leaves input unparsed. Accept a named domain type; run the expected schema or parser at the I/O boundary before calling this function.",
        },
    },
    create(context) {
        const functionsByName = new Map<string, ParameterOwner>();
        const importedParserFunctions = new Map<string, ImportedParserFunction>();
        const typeBoxValueVariables = new Set<Variable>();
        const option = context.options?.[0];
        const allowInTypeGuards =
            typeof option === "object" &&
            option !== null &&
            !Array.isArray(option) &&
            option.allowInTypeGuards === true;

        const isImportedParserCall = (
            call: ESTree.CallExpression,
            argumentIndex: number,
        ): boolean => {
            if (call.callee.type !== "Identifier") return false;
            const parser = importedParserFunctions.get(call.callee.name);
            if (parser === undefined || parser.argumentIndex !== argumentIndex) return false;
            return resolveVariable(context.sourceCode, call.callee) === parser.variable;
        };

        const isTypeBoxValidationSequence = (reads: readonly Reference[]): boolean => {
            let hasParse = false;
            for (const reference of reads) {
                const use = callUsingReference(reference.identifier);
                if (
                    use === null ||
                    use.argumentIndex !== 1 ||
                    use.call.callee.type !== "MemberExpression" ||
                    use.call.callee.computed ||
                    use.call.callee.object.type !== "Identifier" ||
                    use.call.callee.property.type !== "Identifier"
                ) {
                    return false;
                }
                const owner = resolveVariable(context.sourceCode, use.call.callee.object);
                if (owner === null || !typeBoxValueVariables.has(owner)) return false;
                const method = use.call.callee.property.name;
                if (method !== "Errors" && method !== "Parse") return false;
                if (method === "Parse") hasParse = true;
            }
            return hasParse;
        };

        const isStructurallyRecognizedParserParameter = (
            owner: ParameterOwner,
            parameterIndex: number,
            visited = new Set<ParameterOwner>(),
        ): boolean => {
            if (
                visited.has(owner) ||
                owner.returnType === null ||
                owner.returnType === undefined ||
                isTypeGuard(owner)
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
            if (isTypeBoxValidationSequence(reads)) return true;
            if (reads.length !== 1) return false;
            const reference = reads[0]?.identifier;
            if (reference === undefined || !firstExecutableStatementContains(owner, reference)) {
                return false;
            }
            const use = callUsingReference(reference);
            if (use === null) return false;
            if (
                isConcreteParserMethodCall(use.call) ||
                isImportedParserCall(use.call, use.argumentIndex)
            ) {
                return true;
            }
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
                    (allowInTypeGuards && isTypeGuard(node)) ||
                    isConcreteParserDeclarationParameter(
                        node,
                        parameterIndex,
                        context.sourceCode,
                    ) ||
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
                functionsByName.clear();
                importedParserFunctions.clear();
                typeBoxValueVariables.clear();
                for (const statement of node.body) {
                    if (
                        statement.type === "ImportDeclaration" &&
                        statement.source.value === "valibot"
                    ) {
                        for (const specifier of statement.specifiers) {
                            if (specifier.type !== "ImportSpecifier") continue;
                            const imported = sourceKeyName(context.sourceCode, specifier.imported);
                            const argumentIndex = valibotParserFunctions.get(imported);
                            if (argumentIndex === undefined) continue;
                            const variable = resolveVariable(context.sourceCode, specifier.local);
                            if (variable !== null) {
                                importedParserFunctions.set(specifier.local.name, {
                                    argumentIndex,
                                    variable,
                                });
                            }
                        }
                    }
                    if (
                        statement.type === "ImportDeclaration" &&
                        statement.source.value === "typebox/value"
                    ) {
                        for (const specifier of statement.specifiers) {
                            if (specifier.type !== "ImportSpecifier") continue;
                            if (sourceKeyName(context.sourceCode, specifier.imported) !== "Value") {
                                continue;
                            }
                            const variable = resolveVariable(context.sourceCode, specifier.local);
                            if (variable !== null) typeBoxValueVariables.add(variable);
                        }
                    }
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
