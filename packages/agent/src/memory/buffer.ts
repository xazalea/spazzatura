/**
 * Buffer Memory - Stores all messages
 */

import type { IMemory, MemoryEntry, Message } from '../types.js';

/**
 * Simple buffer memory that stores all messages
 */
export class BufferMemory implements IMemory {
  private entries: MemoryEntry[] = [];

  /**
   * Add a message to memory
   */
  add(message: Message): void {
    this.entries.push({
      message,
      timestamp: new Date(),
    });
  }

  /**
   * Get all messages
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
   * Get memory size
   */
  get size(): number {
    return this.entries.length;
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
  static fromJSON(data: { entries: unknown[] }): BufferMemory {
    const memory = new BufferMemory();
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
