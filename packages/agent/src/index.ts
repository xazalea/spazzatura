/**
 * @spazzatura/agent
 * Multi-agent orchestration for Spazzatura
 */

// Core types
export * from './types.js';

// Agent class
export { Agent } from './agent.js';

// Orchestrator
export { AgentOrchestrator } from './orchestrator.js';

// Registry
export { AgentRegistry } from './registry.js';

// Loader
export { AgentLoader } from './loader.js';
export type { LoaderConfig, AgentFileConfig } from './loader.js';

// Tool executor
export { ToolExecutor } from './executor.js';

// Memory implementations
export { BufferMemory } from './memory/buffer.js';
export { WindowMemory } from './memory/window.js';
export { SummaryMemory } from './memory/summary.js';

// Built-in tools (factory functions)
export { createFileTool, FileTool, type FileToolConfig } from './tools/file.js';
export { createShellTool, ShellTool, type ShellToolConfig } from './tools/shell.js';
export { createWebTool, WebTool, type WebToolConfig } from './tools/web.js';
export { createCodeTool, CodeTool, type CodeToolConfig } from './tools/code.js';
export { createMemoryTool, MemoryTool, type MemoryToolConfig } from './tools/memory.js';

// Production-grade agentic runtime (ported from Codebuff)
export { AgentRuntime, type AgentEvent, type AgentRuntimeOptions } from './runtime/agent-runtime.js';
export { runAgent, type RunAgentOptions } from './runtime/run.js';

// Codebuff-ported tools
export { ChangeFileTool, createChangeFileTool, type ChangeFileConfig } from './tools/change-file.js';
export { ApplyPatchTool, createApplyPatchTool, type ApplyPatchConfig } from './tools/apply-patch.js';
export { CodeSearchTool, createCodeSearchTool, type CodeSearchConfig } from './tools/code-search.js';
export { GlobTool, createGlobTool, type GlobConfig } from './tools/glob.js';
export { ListDirectoryTool, createListDirectoryTool, type ListDirectoryConfig } from './tools/list-directory.js';
export { RunTerminalTool, createRunTerminalTool, type RunTerminalConfig } from './tools/run-terminal.js';

// Built-in agents (factory functions and configs)
export { createCoderAgent, CODER_CONFIG } from './builtin/coder.js';
export { createResearcherAgent, RESEARCHER_CONFIG } from './builtin/researcher.js';
export { createReviewerAgent, REVIEWER_CONFIG } from './builtin/reviewer.js';
export { createPlannerAgent, PLANNER_CONFIG } from './builtin/planner.js';
export { createSisyphusAgent, SISYPHUS_CONFIG } from './builtin/sisyphus.js';
export { createHephaestusAgent, HEPHAESTUS_CONFIG } from './builtin/hephaestus.js';
export { createPrometheusAgent, PROMETHEUS_CONFIG } from './builtin/prometheus.js';
export { createMomusAgent, MOMUS_CONFIG } from './builtin/momus.js';
export { createFullstackAgent, FULLSTACK_CONFIG } from './builtin/fullstack.js';
export { createPairProgrammerAgent, PAIR_PROGRAMMER_CONFIG } from './builtin/pair-programmer.js';
export { createTechLeadAgent, TECH_LEAD_CONFIG } from './builtin/tech-lead.js';
export { createSecurityAuditorAgent, SECURITY_AUDITOR_CONFIG } from './builtin/security-auditor.js';
export { createPerformanceOptimizerAgent, PERFORMANCE_OPTIMIZER_CONFIG } from './builtin/performance-optimizer.js';
export { createRefactorerAgent, REFACTORER_CONFIG } from './builtin/refactorer.js';
export { createTestArchitectAgent, TEST_ARCHITECT_CONFIG } from './builtin/test-architect.js';
export { createDocumentationWriterAgent, DOCUMENTATION_WRITER_CONFIG } from './builtin/documentation-writer.js';
export { createApiDesignerAgent, API_DESIGNER_CONFIG } from './builtin/api-designer.js';
export { createDatabaseDesignerAgent, DATABASE_DESIGNER_CONFIG } from './builtin/database-designer.js';
export { createDependencyManagerAgent, DEPENDENCY_MANAGER_CONFIG } from './builtin/dependency-manager.js';
export { createDevopsAgentAgent, DEVOPS_AGENT_CONFIG } from './builtin/devops-agent.js';
export { createGitWorkflowAgent, GIT_WORKFLOW_CONFIG } from './builtin/git-workflow.js';
export { createCloudArchitectAgent, CLOUD_ARCHITECT_CONFIG } from './builtin/cloud-architect.js';
export { createDataScientistAgent, DATA_SCIENTIST_CONFIG } from './builtin/data-scientist.js';
export { createCodebaseExplorerAgent, CODEBASE_EXPLORER_CONFIG } from './builtin/codebase-explorer.js';
export { createDebuggerAgent, DEBUGGER_CONFIG } from './builtin/debugger.js';
export { createScaffoldAgent, SCAFFOLD_CONFIG } from './builtin/scaffold.js';
export { createMigratorAgent, MIGRATOR_CONFIG } from './builtin/migrator.js';
export { createOptimizerLlmAgent, OPTIMIZER_LLM_CONFIG } from './builtin/optimizer-llm.js';

// Validator (zero-mistake dual-agent system)
export { ValidatorAgent, validateFiles, runValidationLoop, validateOnce } from './validator/index.js';
export type { ValidationIssue, ValidationResult, ValidatorOptions, ValidationLoopOptions, LoopResult } from './validator/index.js';

// Agent factory (with provider support)
export { createAgent } from './agent.js';

// Hooks registry and ultrawork detection
export {
  HookRegistry,
  hookRegistry,
} from './hooks/registry.js';

export type {
  HookType,
  HookPayloads,
  HookHandler,
  ChatMessagePayload,
  ToolBeforePayload,
  ToolAfterPayload,
  SystemTransformPayload,
  ChatParamsPayload,
} from './hooks/registry.js';

export {
  detectUltrawork,
  resolveUltraworkOverride,
  resolveValidUltraworkVariant,
  applyUltraworkOverride,
} from './hooks/ultrawork.js';

export type {
  UltraworkConfig,
  UltraworkOverrideResult,
  AvailableModel,
} from './hooks/ultrawork.js';

// Sisyphus context types (for dynamic prompt building)
export type {
  AvailableAgent,
  AvailableSkill,
  AvailableCategory,
  SisyphusContext,
} from './builtin/sisyphus.js';
