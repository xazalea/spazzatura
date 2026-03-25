/**
 * Skill injector — formats active skills for system prompt injection.
 *
 * Mirrors the bootstrap injection pattern from superpowers.js:
 *   - Wraps skills in <EXTREMELY_IMPORTANT> / XML-style tags
 *   - Renders each skill as a named section with its content
 *   - Used by the system prompt transform hook
 */

import type { Skill } from './loader.js';

// ============================================================================
// Formatting helpers
// ============================================================================

/**
 * Render a single skill block for injection.
 *
 * Format:
 *   <skill name="brainstorming">
 *   <description>...</description>
 *   <content>
 *   ...markdown body...
 *   </content>
 *   </skill>
 */
function renderSkillBlock(skill: Skill): string {
  const lines: string[] = [];

  lines.push(`<skill name="${skill.name}">`);

  if (skill.description) {
    lines.push(`<description>${skill.description}</description>`);
  }

  if (skill.dependencies.length > 0) {
    lines.push(`<dependencies>${skill.dependencies.join(', ')}</dependencies>`);
  }

  lines.push('<content>');
  lines.push(skill.content.trim());
  lines.push('</content>');
  lines.push(`</skill>`);

  return lines.join('\n');
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Build a system prompt segment that injects the given skills.
 *
 * The returned string should be appended to (or included in) the system prompt.
 * It follows the superpowers bootstrap convention of wrapping in
 * `<EXTREMELY_IMPORTANT>` tags so the model treats skill instructions with
 * high priority.
 *
 * @param activeSkills  Skills to inject. Pass only the ones the user has
 *                      enabled; don't dump all skills unconditionally.
 */
export function buildSkillsSystemPrompt(activeSkills: Skill[]): string {
  if (activeSkills.length === 0) return '';

  const skillBlocks = activeSkills.map(renderSkillBlock).join('\n\n');

  return `<EXTREMELY_IMPORTANT>
You have the following skills available. When a skill applies to your current task you MUST follow it.

**How to use skills:**
- If you think there is even a 1% chance a skill applies, you MUST invoke it.
- Skills override default system prompt behavior but user instructions always take precedence.
- Rigid skills (TDD, debugging): follow exactly.
- Flexible skills (patterns): adapt principles to context.

<skills>
${skillBlocks}
</skills>
</EXTREMELY_IMPORTANT>`;
}

/**
 * Build a minimal bootstrap prompt that announces available skill names
 * without embedding the full content (saves tokens when skills are numerous).
 *
 * Use this when you want the model to know which skills exist and load
 * individual ones on demand via the Skill tool.
 *
 * @param skills  All available skills.
 */
export function buildSkillsIndexPrompt(skills: Skill[]): string {
  if (skills.length === 0) return '';

  const index = skills
    .map((s) => `- **${s.name}**: ${s.description}`)
    .join('\n');

  return `<EXTREMELY_IMPORTANT>
The following skills are available. Load a skill using the Skill tool before responding to tasks where it might apply.

${index}
</EXTREMELY_IMPORTANT>`;
}
