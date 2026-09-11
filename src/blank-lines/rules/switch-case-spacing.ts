import { asNode, caseConsequent, isSingleLine, switchCases, walkAst } from "../ast.ts";
import { createLayoutRule, pairwise, reportGapPolicy } from "../rule-utils.ts";
import { getSourceCode, rangeOf } from "../spacing.ts";
import type { AstNode, BlankLinePolicy, RuleContext, SourceCode } from "../types.ts";

export interface SwitchCaseSpacingOptions {
    readonly default?: BlankLinePolicy;
    readonly maxCuddledLines?: number;
    readonly longCase?: BlankLinePolicy;
    readonly shortCase?: BlankLinePolicy;
    readonly emptyCase?: BlankLinePolicy;
    readonly ignoreFallthrough?: boolean;
}

type Options = readonly [SwitchCaseSpacingOptions?];

const DEFAULTS: Required<SwitchCaseSpacingOptions> = {
    default: "never",
    maxCuddledLines: 2,
    longCase: "never",
    shortCase: "never",
    emptyCase: "never",
    ignoreFallthrough: true,
};

function isTerminating(statement: AstNode | undefined): boolean {
    if (statement === undefined) {
        return false;
    }
    if (
        new Set(["BreakStatement", "ContinueStatement", "ReturnStatement", "ThrowStatement"]).has(
            statement.type,
        )
    ) {
        return true;
    }
    if (statement.type === "BlockStatement") {
        const body = Array.isArray(statement.body)
            ? statement.body.map(asNode).filter((node): node is AstNode => node !== null)
            : [];
        return isTerminating(body.at(-1));
    }
    return false;
}

const STRUCTURAL_NODES = new Set([
    "CallExpression",
    "NewExpression",
    "ObjectExpression",
    "ArrayExpression",
    "TaggedTemplateExpression",
]);

function producesStructure(node: AstNode): boolean {
    let structural = false;
    walkAst(node, (child) => {
        if (STRUCTURAL_NODES.has(child.type)) {
            structural = true;
        }
    });
    return structural;
}

function isSubstantialCaseBody(caseNode: AstNode, sourceCode: SourceCode): boolean {
    const statements = caseConsequent(caseNode);
    const last = statements.at(-1);
    if (last === undefined) return false;
    if (last.type === "BlockStatement") return true;
    if (last.type !== "ReturnStatement") return false;
    const argument = asNode(last.argument);
    if (argument === null) return true;
    if (argument.type === "LogicalExpression" || argument.type === "BinaryExpression") return true;
    if (argument.type === "ConditionalExpression") {
        return producesStructure(argument) || !isSingleLine(argument, sourceCode.text);
    }
    return producesStructure(argument);
}

function bodyLines(caseNode: AstNode, sourceText: string): number {
    const consequent = caseConsequent(caseNode);
    const first = consequent[0];
    const last = consequent.at(-1);
    if (first === undefined || last === undefined) {
        return 0;
    }
    // Padding inserted by another rule must not turn a short case into a long
    // one and create a new diagnostic on the next lint pass.
    return sourceText
        .slice(rangeOf(first)[0], rangeOf(last)[1])
        .split(/\r\n|\r|\n/)
        .filter((line) => line.trim().length > 0).length;
}

export default createLayoutRule<Options>(
    "Keep switch cases compact with configurable spacing for long, short, and empty cases.",
    [
        {
            type: "object",
            additionalProperties: false,
            properties: {
                default: { enum: ["always", "never", "any"] },
                maxCuddledLines: { type: "integer", minimum: 0 },
                longCase: { enum: ["always", "never", "any"] },
                shortCase: { enum: ["always", "never", "any"] },
                emptyCase: { enum: ["always", "never", "any"] },
                ignoreFallthrough: { type: "boolean" },
            },
        },
    ],
    {
        expectedBlank: "Expected a blank line before this switch case.",
        unexpectedBlank: "Unexpected blank line before this switch case.",
    },
    (context: RuleContext<Options>) => {
        const config = context.options[0] ?? {};
        const basePolicy = config.default ?? DEFAULTS.default;
        const options: Required<SwitchCaseSpacingOptions> = {
            ...DEFAULTS,
            longCase: basePolicy,
            shortCase: basePolicy,
            ...config,
        };
        const sourceCode = getSourceCode(context);
        return {
            SwitchStatement(node): void {
                const clauses = switchCases(node);
                const produces = clauses.some(producesStructure);
                for (const [previous, current] of pairwise(clauses)) {
                    const consequent = caseConsequent(previous);
                    let policy: BlankLinePolicy;
                    if (consequent.length === 0) {
                        policy = options.emptyCase;
                    } else if (options.ignoreFallthrough && !isTerminating(consequent.at(-1))) {
                        policy = "any";
                    } else {
                        // Value-mapping switches always use the short-case policy.
                        const longCase =
                            produces &&
                            (isSubstantialCaseBody(previous, sourceCode) ||
                                bodyLines(previous, sourceCode.text) > options.maxCuddledLines);
                        policy = longCase ? options.longCase : options.shortCase;
                    }
                    reportGapPolicy(context, previous, current, policy, {
                        always: "expectedBlank",
                        never: "unexpectedBlank",
                    });
                }
            },
        };
    },
);
