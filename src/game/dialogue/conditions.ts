/**
 * Condition evaluator -- the only place dialogue conditions are interpreted.
 * Pure function over the DialogueContext interface; engine-neutral.
 */

import type { DialogueCondition, DialogueContext } from './types';

export function evalCondition(cond: DialogueCondition | undefined, ctx: DialogueContext): boolean {
  if (!cond) return true;
  if ('all' in cond) return cond.all.every((c) => evalCondition(c, ctx));
  if ('any' in cond) return cond.any.some((c) => evalCondition(c, ctx));
  if ('not' in cond) return !evalCondition(cond.not, ctx);
  if ('clue' in cond) return ctx.hasClue(cond.clue);
  if ('noClue' in cond) return !ctx.hasClue(cond.noClue);
  if ('flag' in cond) return ctx.hasFlag(cond.flag);
  if ('noFlag' in cond) return !ctx.hasFlag(cond.noFlag);
  if ('asked' in cond) return ctx.hasFlag(cond.asked);
  if ('trust' in cond) {
    const v = ctx.getVar(cond.trust);
    if (cond.gte !== undefined && v < cond.gte) return false;
    if (cond.lte !== undefined && v > cond.lte) return false;
    return true;
  }
  return true;
}
