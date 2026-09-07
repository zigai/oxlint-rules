import { asNode, caseConsequent, switchCases } from "../ast.ts";
import { createLayoutRule, pairwise, reportGapPolicy } from "../rule-utils.ts";
import { getSourceCode, rangeOf } from "../spacing.ts";
import type { AstNode, BlankLinePolicy, RuleContext } from "../types.ts";

export interface SwitchCaseSpacingOptions {
    readonly maxCuddledLines?: number;
    readonly longCase?: BlankLinePolicy;
    readonly shortCase?: BlankLinePolicy;
    readonly emptyCase?: BlankLinePolicy;
    readonly ignoreFallthrough?: boolean;
}

type Options = readonly [SwitchCaseSpacingOptions?];

const DEFAULTS: Required<SwitchCaseSpacingOptions> = {
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
        const options = { ...DEFAULTS, ...context.options[0] };
        const sourceCode = getSourceCode(context);
        return {
            SwitchStatement(node): void {
                for (const [previous, current] of pairwise(switchCases(node))) {
                    const consequent = caseConsequent(previous);
                    let policy: BlankLinePolicy;
                    if (consequent.length === 0) {
                        policy = options.emptyCase;
                    } else if (options.ignoreFallthrough && !isTerminating(consequent.at(-1))) {
                        policy = "any";
                    } else {
                        policy =
                            bodyLines(previous, sourceCode.text) > options.maxCuddledLines
                                ? options.longCase
                                : options.shortCase;
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
