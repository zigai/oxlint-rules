import { blankLinesRules } from "./rules.ts";
import { recommendedRules, testRules, testFiles } from "./recommended.ts";
import type { Plugin } from "./types.ts";

export { blankLinesRules, recommendedRules, testRules };

export { default as blankLineAfterBlock } from "./rules/blank-line-after-block.ts";
export { default as blankLineBeforeExit } from "./rules/blank-line-before-exit.ts";
export { default as blockBoundarySpacing } from "./rules/block-boundary-spacing.ts";
export { default as commentGroupSpacing } from "./rules/comment-group-spacing.ts";
export { default as controlFlowCuddling } from "./rules/control-flow-cuddling.ts";
export { default as declarationGroupSpacing } from "./rules/declaration-group-spacing.ts";
export { default as expressionGroupSpacing } from "./rules/expression-group-spacing.ts";
export { default as linesBetweenClassMembers } from "./rules/lines-between-class-members.ts";
export { default as linesBetweenTypeMembers } from "./rules/lines-between-type-members.ts";
export { default as maxConsecutiveBlankLines } from "./rules/max-consecutive-blank-lines.ts";
export { default as paddingLineBetweenStatements } from "./rules/padding-line-between-statements.ts";
export { default as switchCaseSpacing } from "./rules/switch-case-spacing.ts";

export type * from "./types.ts";
export type * from "./selectors.ts";
export type { BlankLineAfterBlockOptions } from "./rules/blank-line-after-block.ts";
export type { BlankLineBeforeExitOptions } from "./rules/blank-line-before-exit.ts";
export type { BlockBoundarySpacingOptions } from "./rules/block-boundary-spacing.ts";
export type { CommentGroupSpacingOptions } from "./rules/comment-group-spacing.ts";
export type { ControlFlowCuddlingOptions } from "./rules/control-flow-cuddling.ts";
export type { DeclarationGroupSpacingOptions } from "./rules/declaration-group-spacing.ts";
export type { ExpressionGroupSpacingOptions } from "./rules/expression-group-spacing.ts";
export type { LinesBetweenClassMembersOptions } from "./rules/lines-between-class-members.ts";
export type { LinesBetweenTypeMembersOptions } from "./rules/lines-between-type-members.ts";
export type { MaxConsecutiveBlankLinesOptions } from "./rules/max-consecutive-blank-lines.ts";
export type { PaddingLineBetweenStatementsOptions } from "./rules/padding-line-between-statements.ts";
export type { SwitchCaseSpacingOptions } from "./rules/switch-case-spacing.ts";

const blankLinesPlugin: Plugin = {
    meta: {
        name: "blank-lines",
        version: "0.2.0",
    },
    rules: blankLinesRules,
    configs: {
        recommended: {
            rules: recommendedRules,
            overrides: [{ files: testFiles, rules: testRules }],
        },
    },
};

export default blankLinesPlugin;
