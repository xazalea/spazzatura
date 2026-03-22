/**
 * Summary Memory - Summarizes old messages to save context space
 */

import type { IMemory, MemoryEntry, Message } from '../types.js';

/**
 * Summary memory configuration
 */
export interface SummaryMemoryConfig {
  /** Maximum number of recent messages to keep unsummarized */
  readonly maxRecentMessages: number;
  /** Function to generate summary (can use LLM) */
  readonly summarizeFn?: (messages: readonly Message[]) => Promise<string>;
}

/**
 * Summary entry representing summarized content
 */
export interface SummaryEntry {
  readonly type: 'summary';
  readonly content: string;
  readonly messageCount: number;
  readonly timestamp: Date;
}

/**
 * Summary memory that compresses old messages into summaries
 */
export class SummaryMemory implements IMemory {
  private recentEntries: MemoryEntry[] = [];
  private summaries: SummaryEntry[] = [];
  private readonly maxRecentMessages: number;
  private readonly summarizeFn: ((messages: readonly Message[]) => Promise<string>) | undefined;

  constructor(config: SummaryMemoryConfig) {
    this.maxRecentMessages = config.maxRecentMessages;
    this.summarizeFn = config.summarizeFn ?? undefined;
  }

  /**
   * Add a message to memory
   */
  add(message: Message): void {
    this.recentEntries.push({
      message,
      timestamp: new Date(),
    });

    // Check if we need to summarize
    if (this.recentEntries.length > this.maxRecentMessages) {
      this.summarizeOldest();
    }
  }

  /**
   * Summarize the oldest messages
   */
  private async summarizeOldest(): Promise<void> {
    const messagesToSummarize = this.recentEntries.slice(
      0,
      this.recentEntries.length - this.maxRecentMessages
    );

    if (messagesToSummarize.length === 0) return;

    // Keep only recent messages
    this.recentEntries = this.recentEntries.slice(-this.maxRecentMessages);

    // Create summary
    if (this.summarizeFn) {
      try {
        const summary = await this.summarizeFn(
          messagesToSummarize.map((e) => e.message)
        );
        this.summaries.push({
          type: 'summary',
          content: summary,
          messageCount: messagesToSummarize.length,
          timestamp: new Date(),
        });
      } catch {
        // If summarization fails, keep the messages
        this.recentEntries = [...messagesToSummarize, ...this.recentEntries];
      }
    } else {
      // Default summarization: just note the count
      this.summaries.push({
        type: 'summary',
        content: `[${messagesToSummarize.length} messages summarized]`,
        messageCount: messagesToSummarize.length,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Get all messages including summaries
   */
  getAll(): readonly Message[] {
    const messages: Message[] = [];

    // Add summaries as system messages
    for (const summary of this.summaries) {
      messages.push({
        role: 'system',
        content: `Previous conversation summary: ${summary.content}`,
      });
    }

    // Add recent messages
    for (const entry of this.recentEntries) {
      messages.push(entry.message);
    }

    return messages;
  }

  /**
   * Get only recent (unsummarized) messages
   */
  getRecent(): readonly Message[] {
    return this.recentEntries.map((e) => e.message);
  }

  /**
   * Get all summaries
   */
  getSummaries(): readonly SummaryEntry[] {
    return [...this.summaries];
  }

  /**
   * Get all entries with metadata
   */
  getEntries(): readonly MemoryEntry[] {
    return [...this.recentEntries];
  }

  /**
   * Clear all memory including summaries
   */
  clear(): void {
    this.recentEntries = [];
    this.summaries = [];
  }

  /**
   * Get current memory size (recent messages only)
   */
  get size(): number {
    return this.recentEntries.length;
  }

  /**
   * Get total message count including summarized
   */
  get totalMessages(): number {
    const summarizedCount = this.summaries.reduce(
      (sum, s) => sum + s.messageCount,
      0
    );
    return summarizedCount + this.recentEntries.length;
  }

  /**
   * Get summary count
   */
  get summaryCount(): number {
    return this.summaries.length;
  }

  /**
   * Force summarization of all messages
   */
  async summarizeAll(): Promise<void> {
    if (this.recentEntries.length === 0) return;

    const messagesToSummarize = [...this.recentEntries];
    this.recentEntries = [];

    if (this.summarizeFn) {
      const summary = await this.summarizeFn(
        messagesToSummarize.map((e) => e.message)
      );
      this.summaries.push({
        type: 'summary',
        content: summary,
        messageCount: messagesToSummarize.length,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Serialize memory to JSON
   */
  toJSON(): unknown {
    return {
      maxRecentMessages: this.maxRecentMessages,
      recentEntries: this.recentEntries.map((entry) => ({
        message: entry.message,
        timestamp: entry.timestamp.toISOString(),
        metadata: entry.metadata,
      })),
      summaries: this.summaries.map((summary) => ({
        ...summary,
        timestamp: summary.timestamp.toISOString(),
      })),
    };
  }

  /**
   * Restore memory from JSON
   */
  static fromJSON(data: {
    maxRecentMessages: number;
    recentEntries: unknown[];
    summaries: unknown[];
  }): SummaryMemory {
    const memory = new SummaryMemory({ maxRecentMessages: data.maxRecentMessages });

    for (const entry of data.recentEntries as Array<{
      message: Message;
      timestamp: string;
      metadata?: Record<string, unknown>;
    }>) {
      memory.recentEntries.push({
        message: entry.message,
        timestamp: new Date(entry.timestamp),
        ...(entry.metadata !== undefined && { metadata: entry.metadata }),
      } as MemoryEntry);
    }

    for (const summary of data.summaries as Array<{
      content: string;
      messageCount: number;
      timestamp: string;
    }>) {
      memory.summaries.push({
        type: 'summary',
        content: summary.content,
        messageCount: summary.messageCount,
        timestamp: new Date(summary.timestamp),
      });
    }

    return memory;
  }
}
