/**
 * Window Memory - Sliding window that keeps last N messages
 */

import type { IMemory, MemoryEntry, Message } from '../types.js';

/**
 * Window memory configuration
 */
export interface WindowMemoryConfig {
  /** Maximum number of messages to keep */
  readonly maxSize: number;
}

/**
 * Sliding window memory that keeps only the last N messages
 */
export class WindowMemory implements IMemory {
  private entries: MemoryEntry[] = [];
  private readonly maxSize: number;

  constructor(config: WindowMemoryConfig) {
    this.maxSize = config.maxSize;
  }

  /**
   * Add a message to memory
   * If the window is full, oldest messages are removed
   */
  add(message: Message): void {
    this.entries.push({
      message,
      timestamp: new Date(),
    });

    // Trim to max size
    while (this.entries.length > this.maxSize) {
      this.entries.shift();
    }
  }

  /**
   * Get all messages in the window
   */
  getAll(): readonly Message[] {
    return this.entries.map((entry) => entry.message);
  }

  /**
   * Get all entries with metadata
   */
  getEntries(): readonly MemoryEntry[] {
    return [...this.entries];
  }

  /**
   * Clear memory
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Get current memory size
   */
  get size(): number {
    return this.entries.length;
  }

  /**
   * Get maximum window size
   */
  get windowSize(): number {
    return this.maxSize;
  }

  /**
   * Check if window is full
   */
  get isFull(): boolean {
    return this.entries.length >= this.maxSize;
  }

  /**
   * Get last N messages
   */
  getLast(n: number): readonly Message[] {
    return this.entries.slice(-n).map((entry) => entry.message);
  }

  /**
   * Find messages by role
   */
  findByRole(role: Message['role']): readonly Message[] {
    return this.entries
      .filter((entry) => entry.message.role === role)
      .map((entry) => entry.message);
  }

  /**
   * Serialize memory to JSON
   */
  toJSON(): unknown {
    return {
      maxSize: this.maxSize,
      entries: this.entries.map((entry) => ({
        message: entry.message,
        timestamp: entry.timestamp.toISOString(),
        metadata: entry.metadata,
      })),
    };
  }

  /**
   * Restore memory from JSON
   */
  static fromJSON(data: {
    maxSize: number;
    entries: unknown[];
  }): WindowMemory {
    const memory = new WindowMemory({ maxSize: data.maxSize });
    for (const entry of data.entries as Array<{
      message: Message;
      timestamp: string;
      metadata?: Record<string, unknown>;
    }>) {
      memory.entries.push({
        message: entry.message,
        timestamp: new Date(entry.timestamp),
        ...(entry.metadata !== undefined && { metadata: entry.metadata }),
      } as MemoryEntry);
    }
    return memory;
  }
}
