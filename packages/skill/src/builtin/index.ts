export { brainstormingSkill } from './brainstorming.js';
export { tddSkill } from './tdd.js';
export { writePlanSkill } from './write-plan.js';
export { codeReviewSkill } from './code-review.js';
export { gitWorktreesSkill } from './git-worktrees.js';
export { subagentDevSkill } from './subagent-dev.js';
export { finishBranchSkill } from './finish-branch.js';

import { brainstormingSkill } from './brainstorming.js';
import { tddSkill } from './tdd.js';
import { writePlanSkill } from './write-plan.js';
import { codeReviewSkill } from './code-review.js';
import { gitWorktreesSkill } from './git-worktrees.js';
import { subagentDevSkill } from './subagent-dev.js';
import { finishBranchSkill } from './finish-branch.js';
import type { ISkill } from '@spazzatura/core';

export const BUILTIN_SKILLS: ISkill[] = [
  brainstormingSkill,
  tddSkill,
  writePlanSkill,
  codeReviewSkill,
  gitWorktreesSkill,
  subagentDevSkill,
  finishBranchSkill,
];
