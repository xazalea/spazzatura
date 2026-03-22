/**
 * Multi-agent orchestration
 * Supports parallel, sequential, and fallback execution patterns
 */

import { randomUUID } from 'crypto';
import type {
  IAgent,
  AgentRun,
  OrchestrationStep,
  OrchestrationResult,
} from './types.js';

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /** Maximum concurrent agents for parallel execution */
  readonly maxConcurrency?: number;
  /** Default timeout for orchestration in milliseconds */
  readonly defaultTimeout?: number;
  /** Enable logging */
  readonly enableLogging?: boolean;
}

/**
 * Agent orchestrator for multi-agent workflows
 */
export class AgentOrchestrator {
  private readonly agents: Map<string, IAgent> = new Map();
  private readonly runs: Map<string, AgentRun> = new Map();
  private readonly maxConcurrency: number;
  private readonly enableLogging: boolean;

  constructor(config: OrchestratorConfig = {}) {
    this.maxConcurrency = config.maxConcurrency ?? 5;
    this.enableLogging = config.enableLogging ?? false;
  }

  /**
   * Register an agent
   */
  registerAgent(agent: IAgent): void {
    this.agents.set(agent.id, agent);
    this.log(`Registered agent: ${agent.name} (${agent.id})`);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(id: string): void {
    this.agents.delete(id);
    this.log(`Unregistered agent: ${id}`);
  }

  /**
   * Get an agent by ID
   */
  getAgent(id: string): IAgent | undefined {
    return this.agents.get(id);
  }

  /**
   * List all registered agents
   */
  listAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Run a single agent
   */
  async run(agentId: string, input: string): Promise<AgentRun> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    this.log(`Running agent: ${agent.name}`);
    const run = await agent.run(input);
    this.runs.set(run.id, run);
    return run;
  }

  /**
   * Run multiple agents in parallel
   */
  async runParallel(
    agentIds: string[],
    input: string
  ): Promise<Map<string, AgentRun>> {
    const results = new Map<string, AgentRun>();

    // Validate all agents exist
    for (const id of agentIds) {
      if (!this.agents.has(id)) {
        throw new Error(`Agent not found: ${id}`);
      }
    }

    this.log(`Running ${agentIds.length} agents in parallel`);

    // Execute in batches based on maxConcurrency
    const batches: string[][] = [];
    for (let i = 0; i < agentIds.length; i += this.maxConcurrency) {
      batches.push(agentIds.slice(i, i + this.maxConcurrency));
    }

    for (const batch of batches) {
      const promises = batch.map(async (id) => {
        const agent = this.agents.get(id)!;
        const run = await agent.run(input);
        this.runs.set(run.id, run);
        return [id, run] as const;
      });

      const batchResults = await Promise.all(promises);
      for (const [id, run] of batchResults) {
        results.set(id, run);
      }
    }

    return results;
  }

  /**
   * Run agents sequentially with output chaining
   */
  async runSequential(steps: OrchestrationStep[]): Promise<OrchestrationResult> {
    const sessionId = randomUUID();
    const startTime = new Date();
    const results = new Map<string, AgentRun>();
    let previousOutput: unknown;

    this.log(`Starting sequential orchestration: ${sessionId}`);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!;
      const agent = this.agents.get(step.agentId);

      if (!agent) {
        return {
          sessionId,
          results,
          success: false,
          duration: Date.now() - startTime.getTime(),
          error: `Agent not found: ${step.agentId}`,
        };
      }

      // Check condition
      if (step.condition && !step.condition(previousOutput)) {
        this.log(`Step ${i + 1} skipped due to condition`);
        continue;
      }

      // Resolve input
      const input = typeof step.input === 'function'
        ? step.input(previousOutput)
        : step.input;

      this.log(`Step ${i + 1}: Running ${agent.name}`);

      try {
        const run = await agent.run(input);
        results.set(step.agentId, run);
        this.runs.set(run.id, run);

        if (run.status === 'failed' && run.error) {
          return {
            sessionId,
            results,
            success: false,
            duration: Date.now() - startTime.getTime(),
            error: run.error,
          };
        }

        previousOutput = run.output;
      } catch (error) {
        return {
          sessionId,
          results,
          success: false,
          duration: Date.now() - startTime.getTime(),
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    const output = typeof previousOutput === 'string' ? previousOutput : undefined;
    return {
      sessionId,
      results,
      ...(output !== undefined && { output }),
      success: true,
      duration: Date.now() - startTime.getTime(),
    };
  }

  /**
   * Run with fallback agents
   */
  async runWithFallback(
    primaryId: string,
    fallbackIds: string[],
    input: string
  ): Promise<AgentRun> {
    const allIds = [primaryId, ...fallbackIds];

    for (const agentId of allIds) {
      const agent = this.agents.get(agentId);
      if (!agent) {
        this.log(`Agent not found: ${agentId}, skipping`);
        continue;
      }

      this.log(`Attempting agent: ${agent.name}`);

      try {
        const run = await agent.run(input);
        this.runs.set(run.id, run);

        if (run.status === 'completed') {
          return run;
        }

        this.log(`Agent ${agent.name} failed, trying fallback`);
      } catch (error) {
        this.log(`Agent ${agent.name} threw error: ${error}`);
      }
    }

    // All agents failed
    throw new Error('All agents failed to complete the task');
  }

  /**
   * Run a pipeline (alias for sequential with specific config)
   */
  async runPipeline(
    steps: Array<{ agentId: string; input?: string }>
  ): Promise<OrchestrationResult> {
    const orchestrationSteps: OrchestrationStep[] = steps.map((step, index) => ({
      agentId: step.agentId,
      input: step.input ?? ((prev: unknown) => String(prev ?? '')),
      name: `Step ${index + 1}`,
    }));

    return this.runSequential(orchestrationSteps);
  }

  /**
   * Run with hierarchical pattern (manager-worker)
   */
  async runHierarchical(
    managerId: string,
    workerIds: string[],
    input: string
  ): Promise<OrchestrationResult> {
    const sessionId = randomUUID();
    const startTime = new Date();
    const results = new Map<string, AgentRun>();

    const manager = this.agents.get(managerId);
    if (!manager) {
      return {
        sessionId,
        results,
        success: false,
        duration: Date.now() - startTime.getTime(),
        error: `Manager agent not found: ${managerId}`,
      };
    }

    this.log(`Running hierarchical orchestration with manager: ${manager.name}`);

    // Run manager to get tasks
    const managerRun = await manager.run(input);
    results.set(managerId, managerRun);
    this.runs.set(managerRun.id, managerRun);

    if (managerRun.status !== 'completed') {
      return {
        sessionId,
        results,
        success: false,
        duration: Date.now() - startTime.getTime(),
        error: 'Manager failed to create task plan',
      };
    }

    // Run workers in parallel
    const workerResults = await this.runParallel(workerIds, managerRun.output ?? input);

    for (const [id, run] of workerResults) {
      results.set(id, run);
    }

    // Aggregate results
    const success = Array.from(workerResults.values()).every((r) => r.status === 'completed');

    return {
      sessionId,
      results,
      output: this.aggregateResults(workerResults),
      success,
      duration: Date.now() - startTime.getTime(),
    };
  }

  /**
   * Get a run by ID
   */
  getRun(runId: string): AgentRun | undefined {
    return this.runs.get(runId);
  }

  /**
   * List all runs
   */
  listRuns(): AgentRun[] {
    return Array.from(this.runs.values());
  }

  /**
   * Clear run history
   */
  clearRuns(): void {
    this.runs.clear();
  }

  /**
   * Aggregate results from multiple runs
   */
  private aggregateResults(results: Map<string, AgentRun>): string {
    const outputs: string[] = [];

    for (const [id, run] of results) {
      if (run.output) {
        outputs.push(`[${id}]: ${run.output}`);
      }
    }

    return outputs.join('\n\n');
  }

  /**
   * Log message if logging is enabled
   */
  private log(message: string): void {
    if (this.enableLogging) {
      console.log(`[Orchestrator] ${message}`);
    }
  }
}

/**
 * Create an orchestrator with optional configuration
 */
export function createOrchestrator(config?: OrchestratorConfig): AgentOrchestrator {
  return new AgentOrchestrator(config);
}
