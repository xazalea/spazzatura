/**
 * Command history management
 * Persistent history storage and retrieval
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * History entry
 */
export interface HistoryEntry {
  timestamp: number;
  command: string;
  sessionId?: string;
}

/**
 * History manager options
 */
export interface HistoryOptions {
  maxSize?: number;
  filePath?: string;
  sessionBased?: boolean;
}

/**
 * History manager class
 */
export class HistoryManager {
  private entries: HistoryEntry[] = [];
  private maxSize: number;
  private filePath: string;
  private sessionId: string;
  private loaded: boolean = false;
  
  constructor(options: HistoryOptions = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.sessionId = Date.now().toString(36);
    
    const defaultPath = path.join(
      os.homedir(),
      '.spazzatura',
      'history.json'
    );
    
    this.filePath = options.filePath ?? defaultPath;
  }
  
  /**
   * Load history from file
   */
  load(): HistoryEntry[] {
    if (this.loaded) {
      return this.entries;
    }
    
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        this.entries = JSON.parse(data);
      }
    } catch (error) {
      // If loading fails, start with empty history
      this.entries = [];
    }
    
    this.loaded = true;
    return this.entries;
  }
  
  /**
   * Save history to file
   */
  save(): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(
        this.filePath,
        JSON.stringify(this.entries.slice(-this.maxSize), null, 2)
      );
    } catch (error) {
      // Silently fail if saving is not possible
    }
  }
  
  /**
   * Add entry to history
   */
  add(command: string): void {
    if (!command.trim()) return;
    
    // Don't add duplicates in sequence
    if (this.entries.length > 0) {
      const last = this.entries[this.entries.length - 1];
      if (last.command === command) return;
    }
    
    this.entries.push({
      timestamp: Date.now(),
      command,
      sessionId: this.sessionId,
    });
    
    // Trim if over max size
    if (this.entries.length > this.maxSize) {
      this.entries = this.entries.slice(-this.maxSize);
    }
    
    this.save();
  }
  
  /**
   * Get all entries
   */
  getAll(): HistoryEntry[] {
    return [...this.entries];
  }
  
  /**
   * Get entries for current session
   */
  getSession(): HistoryEntry[] {
    return this.entries.filter(e => e.sessionId === this.sessionId);
  }
  
  /**
   * Get recent entries
   */
  getRecent(count: number = 20): HistoryEntry[] {
    return this.entries.slice(-count);
  }
  
  /**
   * Search history
   */
  search(query: string): HistoryEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.entries.filter(e => 
      e.command.toLowerCase().includes(lowerQuery)
    );
  }
  
  /**
   * Clear all history
   */
  clear(): void {
    this.entries = [];
    this.save();
  }
  
  /**
   * Get history as string array (for readline)
   */
  getCommands(): string[] {
    return this.entries.map(e => e.command);
  }
  
  /**
   * Get last N commands
   */
  getLastCommands(count: number = 10): string[] {
    return this.entries
      .slice(-count)
      .map(e => e.command);
  }
  
  /**
   * Export history to file
   */
  export(outputPath: string): void {
    fs.writeFileSync(
      outputPath,
      JSON.stringify(this.entries, null, 2)
    );
  }
  
  /**
   * Import history from file
   */
  import(inputPath: string): void {
    const data = fs.readFileSync(inputPath, 'utf-8');
    const imported = JSON.parse(data);
    
    if (Array.isArray(imported)) {
      this.entries = [...this.entries, ...imported];
      this.save();
    }
  }
  
  /**
   * Get history statistics
   */
  getStats(): {
    total: number;
    sessions: number;
    oldest: Date | null;
    newest: Date | null;
    topCommands: Array<{ command: string; count: number }>;
  } {
    const sessions = new Set(this.entries.map(e => e.sessionId));
    
    const commandCounts = new Map<string, number>();
    for (const entry of this.entries) {
      const count = commandCounts.get(entry.command) ?? 0;
      commandCounts.set(entry.command, count + 1);
    }
    
    const topCommands = Array.from(commandCounts.entries())
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return {
      total: this.entries.length,
      sessions: sessions.size,
      oldest: this.entries.length > 0 
        ? new Date(this.entries[0].timestamp) 
        : null,
      newest: this.entries.length > 0 
        ? new Date(this.entries[this.entries.length - 1].timestamp) 
        : null,
      topCommands,
    };
  }
}

/**
 * Create a history manager singleton
 */
let defaultHistoryManager: HistoryManager | null = null;

export function getHistoryManager(options?: HistoryOptions): HistoryManager {
  if (!defaultHistoryManager) {
    defaultHistoryManager = new HistoryManager(options);
  }
  return defaultHistoryManager;
}
