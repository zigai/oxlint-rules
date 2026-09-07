import blankLineAfterBlock from "./rules/blank-line-after-block.ts";
import blankLineBeforeExit from "./rules/blank-line-before-exit.ts";
import blockBoundarySpacing from "./rules/block-boundary-spacing.ts";
import commentGroupSpacing from "./rules/comment-group-spacing.ts";
import controlFlowCuddling from "./rules/control-flow-cuddling.ts";
import declarationGroupSpacing from "./rules/declaration-group-spacing.ts";
import expressionGroupSpacing from "./rules/expression-group-spacing.ts";
import linesBetweenClassMembers from "./rules/lines-between-class-members.ts";
import linesBetweenTypeMembers from "./rules/lines-between-type-members.ts";
import maxConsecutiveBlankLines from "./rules/max-consecutive-blank-lines.ts";
import paddingLineBetweenStatements from "./rules/padding-line-between-statements.ts";
import switchCaseSpacing from "./rules/switch-case-spacing.ts";

/** Rules exported by the blank-lines plugin. */
export const blankLinesRules = {
    "blank-line-after-block": blankLineAfterBlock,
    "blank-line-before-exit": blankLineBeforeExit,
    "block-boundary-spacing": blockBoundarySpacing,
    "comment-group-spacing": commentGroupSpacing,
    "control-flow-cuddling": controlFlowCuddling,
    "declaration-group-spacing": declarationGroupSpacing,
    "expression-group-spacing": expressionGroupSpacing,
    "lines-between-class-members": linesBetweenClassMembers,
    "lines-between-type-members": linesBetweenTypeMembers,
    "max-consecutive-blank-lines": maxConsecutiveBlankLines,
    "padding-line-between-statements": paddingLineBetweenStatements,
    "switch-case-spacing": switchCaseSpacing,
};
