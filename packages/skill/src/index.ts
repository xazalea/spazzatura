/**
 * @spazzatura/skill
 * Skills system for Spazzatura
 */

export * from './types.js';
export * from './builtin/index.js';
export { loadSkills, formatAvailableSkillsXml } from './loader.js';
export type { SkillDefinition, SkillsMap, LoadSkillsOptions, Skill } from './loader.js';
export { buildSkillsSystemPrompt, buildSkillsIndexPrompt } from './injector.js';
