/**
 * History management for template generation with undo/redo support
 * Inspired by codebuff's undo/redo functionality
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  IHistoryManager,
  GenerationResult,
  GeneratedFile,
} from './types.js';

/**
 * Default maximum history size
 */
const DEFAULT_MAX_SIZE = 50;

/**
 * History manager implementation
 */
export class HistoryManager implements IHistoryManager {
  protected history: GenerationResult[] = [];
  protected undone: GenerationResult[] = [];
  protected maxSize: number = DEFAULT_MAX_SIZE;
  protected currentPosition: number = 0;
  
  /**
   * Record a generation in history
   */
  record(generation: GenerationResult): void {
    // If we're not at the end of history, truncate forward history
    if (this.currentPosition < this.history.length) {
      this.history = this.history.slice(0, this.currentPosition);
    }
    
    // Add the generation to history
    this.history.push(generation);
    this.currentPosition = this.history.length;
    
    // Clear redo stack when new action is recorded
    this.undone = [];
    
    // Enforce max size
    this.enforceMaxSize();
  }
  
  /**
   * Undo the last generation
   */
  async undo(): Promise<GenerationResult | undefined> {
    if (!this.canUndo()) {
      return undefined;
    }
    
    const generation = this.history[this.currentPosition - 1];
    if (!generation) {
      return undefined;
    }
    
    // Restore files to their original state
    await this.restoreFiles(generation, true);
    
    // Mark as undone
    generation.undone = true;
    this.undone.push(generation);
    this.currentPosition--;
    
    return generation;
  }
  
  /**
   * Redo a previously undone generation
   */
  async redo(): Promise<GenerationResult | undefined> {
    if (!this.canRedo()) {
      return undefined;
    }
    
    const generation = this.undone.pop();
    if (!generation) {
      return undefined;
    }
    
    // Re-apply the generation
    await this.restoreFiles(generation, false);
    
    // Mark as not undone
    generation.undone = false;
    this.currentPosition++;
    
    return generation;
  }
  
  /**
   * Get all history entries
   */
  getHistory(): GenerationResult[] {
    return [...this.history];
  }
  
  /**
   * Clear all history
   */
  clear(): void {
    this.history = [];
    this.undone = [];
    this.currentPosition = 0;
  }
  
  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.currentPosition > 0;
  }
  
  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.undone.length > 0;
  }
  
  /**
   * Get current position in history
   */
  getPosition(): number {
    return this.currentPosition;
  }
  
  /**
   * Set maximum history size
   */
  setMaxSize(size: number): void {
    this.maxSize = size;
    this.enforceMaxSize();
  }
  
  /**
   * Get a specific generation by ID
   */
  getGeneration(id: string): GenerationResult | undefined {
    return this.history.find((g) => g.id === id);
  }
  
  /**
   * Undo a specific generation by ID
   */
  async undoById(id: string): Promise<GenerationResult | undefined> {
    const index = this.history.findIndex((g) => g.id === id);
    if (index === -1 || index >= this.currentPosition) {
      return undefined;
    }
    
    // Undo all generations from current position to the target
    while (this.currentPosition > index + 1) {
      await this.undo();
    }
    
    return this.history[index];
  }
  
  /**
   * Get the last generation
   */
  getLastGeneration(): GenerationResult | undefined {
    if (this.currentPosition === 0) {
      return undefined;
    }
    return this.history[this.currentPosition - 1];
  }
  
  /**
   * Get generations by template name
   */
  getGenerationsByTemplate(templateName: string): GenerationResult[] {
    return this.history.filter((g) => g.template === templateName);
  }
  
  /**
   * Get generations within a time range
   */
  getGenerationsByTimeRange(start: Date, end: Date): GenerationResult[] {
    return this.history.filter((g) => {
      const time = new Date(g.timestamp);
      return time >= start && time <= end;
    });
  }
  
  /**
   * Export history to JSON
   */
  exportHistory(): string {
    return JSON.stringify({
      history: this.history,
      undone: this.undone,
      currentPosition: this.currentPosition,
      maxSize: this.maxSize,
    }, null, 2);
  }
  
  /**
   * Import history from JSON
   */
  importHistory(json: string): void {
    try {
      const data = JSON.parse(json);
      if (Array.isArray(data.history)) {
        this.history = data.history;
      }
      if (Array.isArray(data.undone)) {
        this.undone = data.undone;
      }
      if (typeof data.currentPosition === 'number') {
        this.currentPosition = data.currentPosition;
      }
      if (typeof data.maxSize === 'number') {
        this.maxSize = data.maxSize;
      }
    } catch (error) {
      throw new Error(`Failed to import history: ${error}`);
    }
  }
  
  /**
   * Restore files for a generation
   */
  protected async restoreFiles(generation: GenerationResult, undo: boolean): Promise<void> {
    for (const file of generation.files) {
      try {
        await this.restoreFile(file, generation.cwd, undo);
      } catch (error) {
        // Log error but continue with other files
        console.error(`Failed to restore file ${file.path}:`, error);
      }
    }
  }
  
  /**
   * Restore a single file
   */
  protected async restoreFile(file: GeneratedFile, cwd: string, undo: boolean): Promise<void> {
    const filePath = path.resolve(cwd, file.path);
    
    if (undo) {
      // Undo: restore original content
      if (file.action === 'create') {
        // File was created, delete it
        try {
          await fs.unlink(filePath);
        } catch {
          // File might not exist
        }
      } else if (file.action === 'modify' && file.originalContent !== undefined) {
        // File was modified, restore original content
        await fs.writeFile(filePath, file.originalContent, 'utf-8');
      } else if (file.action === 'delete' && file.originalContent !== undefined) {
        // File was deleted, recreate it
        await fs.writeFile(filePath, file.originalContent, 'utf-8');
      }
    } else {
      // Redo: re-apply the generated content
      if (file.action === 'create' || file.action === 'modify') {
        // Ensure directory exists
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, file.content, 'utf-8');
      } else if (file.action === 'delete') {
        try {
          await fs.unlink(filePath);
        } catch {
          // File might not exist
        }
      }
    }
  }
  
  /**
   * Enforce maximum history size
   */
  private enforceMaxSize(): void {
    if (this.history.length > this.maxSize) {
      const removeCount = this.history.length - this.maxSize;
      this.history = this.history.slice(removeCount);
      this.currentPosition = Math.max(0, this.currentPosition - removeCount);
    }
  }
}

/**
 * Create a generation ID
 */
export function generateId(): string {
  return `gen_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a history manager instance
 */
export function createHistoryManager(): IHistoryManager {
  return new HistoryManager();
}

/**
 * Transaction-based history manager for atomic operations
 */
export class TransactionHistoryManager extends HistoryManager {
  private currentTransaction: GenerationResult[] = [];
  private inTransactionFlag: boolean = false;
  
  /**
   * Start a transaction
   */
  beginTransaction(): void {
    this.currentTransaction = [];
    this.inTransactionFlag = true;
  }
  
  /**
   * Add a generation to the current transaction
   */
  addToTransaction(generation: GenerationResult): void {
    if (!this.inTransactionFlag) {
      throw new Error('No transaction in progress');
    }
    this.currentTransaction.push(generation);
  }
  
  /**
   * Commit the current transaction
   */
  commitTransaction(): GenerationResult | undefined {
    if (!this.inTransactionFlag) {
      throw new Error('No transaction in progress');
    }
    
    if (this.currentTransaction.length === 0) {
      this.inTransactionFlag = false;
      return undefined;
    }
    
    // Merge all generations in the transaction
    const mergedGeneration = this.mergeGenerations(this.currentTransaction);
    
    // Record the merged generation
    super.record(mergedGeneration);
    
    // Clear transaction state
    this.currentTransaction = [];
    this.inTransactionFlag = false;
    
    return mergedGeneration;
  }
  
  /**
   * Rollback the current transaction
   */
  async rollbackTransaction(): Promise<void> {
    if (!this.inTransactionFlag) {
      throw new Error('No transaction in progress');
    }
    
    // Undo all generations in the transaction in reverse order
    for (let i = this.currentTransaction.length - 1; i >= 0; i--) {
      const generation = this.currentTransaction[i];
      if (generation) {
        await this.restoreFiles(generation, true);
      }
    }
    
    // Clear transaction state
    this.currentTransaction = [];
    this.inTransactionFlag = false;
  }
  
  /**
   * Check if a transaction is in progress
   */
  isInTransaction(): boolean {
    return this.inTransactionFlag;
  }
  
  /**
   * Merge multiple generations into one
   */
  private mergeGenerations(generations: GenerationResult[]): GenerationResult {
    if (generations.length === 0) {
      throw new Error('No generations to merge');
    }
    
    if (generations.length === 1) {
      const gen = generations[0];
      if (!gen) throw new Error('Generation is undefined');
      return gen;
    }
    
    const first = generations[0]!;
    const last = generations[generations.length - 1]!;
    
    // Merge all files, keeping track of the original content
    const fileMap = new Map<string, GeneratedFile>();
    
    for (const generation of generations) {
      for (const file of generation.files) {
        const existing = fileMap.get(file.path);
        if (existing) {
          // Update existing file entry, preserving original content from first occurrence
          const mergedFile: GeneratedFile = {
            path: file.path,
            content: file.content,
            originalContent: existing.originalContent,
            action: file.action,
            written: file.written,
            error: file.error,
          };
          fileMap.set(file.path, mergedFile);
        } else {
          fileMap.set(file.path, file);
        }
      }
    }
    
    const duration = last.duration !== undefined && first.duration !== undefined
      ? first.duration + last.duration
      : first.duration;
    
    const result: GenerationResult = {
      id: generateId(),
      template: first.template,
      variables: first.variables,
      files: Array.from(fileMap.values()),
      timestamp: first.timestamp,
      undone: false,
      cwd: first.cwd,
    };
    
    if (duration !== undefined) {
      result.duration = duration;
    }
    
    return result;
  }
}

/**
 * Create a transaction-based history manager
 */
export function createTransactionHistoryManager(): TransactionHistoryManager {
  return new TransactionHistoryManager();
}
