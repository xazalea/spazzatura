/**
 * MCP Server Registry
 * Discovery and management of MCP server packages
 */

import type {
  MCPServerConfig,
  MCPServerPackage,
  MCPServerTemplate,
  MCPServerId,
} from './types.js';

/**
 * Built-in MCP server packages registry
 */
const BUILTIN_PACKAGES: Map<string, MCPServerPackage> = new Map([
  ['filesystem', {
    name: 'filesystem',
    version: '0.6.0',
    description: 'Filesystem operations MCP server',
    npmPackage: '@modelcontextprotocol/server-filesystem',
    envVars: [],
    defaultConfig: {
      id: 'filesystem',
      name: 'Filesystem',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
    },
  }],
  ['github', {
    name: 'github',
    version: '0.6.0',
    description: 'GitHub API MCP server',
    npmPackage: '@modelcontextprotocol/server-github',
    envVars: ['GITHUB_TOKEN'],
    defaultConfig: {
      id: 'github',
      name: 'GitHub',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
    },
  }],
  ['postgres', {
    name: 'postgres',
    version: '0.6.0',
    description: 'PostgreSQL database MCP server',
    npmPackage: '@modelcontextprotocol/server-postgres',
    envVars: ['DATABASE_URL'],
    defaultConfig: {
      id: 'postgres',
      name: 'PostgreSQL',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres'],
    },
  }],
  ['brave-search', {
    name: 'brave-search',
    version: '0.6.0',
    description: 'Brave Search MCP server',
    npmPackage: '@modelcontextprotocol/server-brave-search',
    envVars: ['BRAVE_API_KEY'],
    defaultConfig: {
      id: 'brave-search',
      name: 'Brave Search',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
    },
  }],
  ['memory', {
    name: 'memory',
    version: '0.6.0',
    description: 'Memory storage MCP server',
    npmPackage: '@modelcontextprotocol/server-memory',
    envVars: [],
    defaultConfig: {
      id: 'memory',
      name: 'Memory',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
    },
  }],
  ['slack', {
    name: 'slack',
    version: '0.6.0',
    description: 'Slack MCP server',
    npmPackage: '@modelcontextprotocol/server-slack',
    envVars: ['SLACK_BOT_TOKEN', 'SLACK_TEAM_ID'],
    defaultConfig: {
      id: 'slack',
      name: 'Slack',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-slack'],
    },
  }],
  ['google-maps', {
    name: 'google-maps',
    version: '0.6.0',
    description: 'Google Maps MCP server',
    npmPackage: '@modelcontextprotocol/server-google-maps',
    envVars: ['GOOGLE_MAPS_API_KEY'],
    defaultConfig: {
      id: 'google-maps',
      name: 'Google Maps',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-google-maps'],
    },
  }],
  ['puppeteer', {
    name: 'puppeteer',
    version: '0.6.0',
    description: 'Puppeteer browser automation MCP server',
    npmPackage: '@modelcontextprotocol/server-puppeteer',
    envVars: [],
    defaultConfig: {
      id: 'puppeteer',
      name: 'Puppeteer',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    },
  }],
  ['sequential-thinking', {
    name: 'sequential-thinking',
    version: '0.6.0',
    description: 'Sequential thinking MCP server',
    npmPackage: '@modelcontextprotocol/server-sequential-thinking',
    envVars: [],
    defaultConfig: {
      id: 'sequential-thinking',
      name: 'Sequential Thinking',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    },
  }],
  ['sqlite', {
    name: 'sqlite',
    version: '0.6.0',
    description: 'SQLite database MCP server',
    npmPackage: '@modelcontextprotocol/server-sqlite',
    envVars: [],
    defaultConfig: {
      id: 'sqlite',
      name: 'SQLite',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sqlite'],
    },
  }],
]);

/**
 * MCP Server Registry
 */
export class MCPRegistry {
  private packages: Map<string, MCPServerPackage> = new Map(BUILTIN_PACKAGES);
  private templates: Map<string, MCPServerTemplate> = new Map();

  /**
   * List all available packages
   */
  listPackages(): MCPServerPackage[] {
    return Array.from(this.packages.values());
  }

  /**
   * Get a package by name
   */
  getPackage(name: string): MCPServerPackage | undefined {
    return this.packages.get(name);
  }

  /**
   * Check if a package exists
   */
  hasPackage(name: string): boolean {
    return this.packages.has(name);
  }

  /**
   * Register a new package
   */
  registerPackage(pkg: MCPServerPackage): void {
    this.packages.set(pkg.name, pkg);
  }

  /**
   * Unregister a package
   */
  unregisterPackage(name: string): boolean {
    return this.packages.delete(name);
  }

  /**
   * Create server config from a package
   */
  createConfigFromPackage(
    packageName: string,
    options?: {
      id?: MCPServerId;
      name?: string;
      args?: readonly string[];
      env?: Record<string, string>;
      cwd?: string;
      timeout?: number;
    }
  ): MCPServerConfig {
    const pkg = this.packages.get(packageName);
    if (!pkg) {
      throw new Error(`Package not found: ${packageName}`);
    }

    // Check required environment variables
    if (pkg.envVars && pkg.envVars.length > 0) {
      const missing = pkg.envVars.filter(
        (varName) => !process.env[varName] && !options?.env?.[varName]
      );
      if (missing.length > 0) {
        console.warn(
          `Warning: Missing environment variables for ${packageName}: ${missing.join(', ')}`
        );
      }
    }

    // Merge default config with options
    const defaultConfig = pkg.defaultConfig || {};
    const config: MCPServerConfig = {
      id: options?.id ?? packageName,
      name: options?.name ?? pkg.name,
      transport: defaultConfig.transport ?? 'stdio',
      command: defaultConfig.command ?? 'npx',
      env: { ...defaultConfig.env, ...options?.env },
    };
    
    // Only add optional properties if they have values
    const args = options?.args ?? defaultConfig.args;
    if (args) {
      (config as { args: readonly string[] }).args = args;
    }
    const cwd = options?.cwd ?? defaultConfig.cwd;
    if (cwd) {
      (config as { cwd: string }).cwd = cwd;
    }
    const timeout = options?.timeout ?? defaultConfig.timeout;
    if (timeout) {
      (config as { timeout: number }).timeout = timeout;
    }
    
    return config;
  }

  /**
   * List all templates
   */
  listTemplates(): MCPServerTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get a template by ID
   */
  getTemplate(id: string): MCPServerTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Register a template
   */
  registerTemplate(template: MCPServerTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Unregister a template
   */
  unregisterTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  /**
   * Search packages by name or description
   */
  searchPackages(query: string): MCPServerPackage[] {
    const lowerQuery = query.toLowerCase();
    return this.listPackages().filter(
      (pkg) =>
        pkg.name.toLowerCase().includes(lowerQuery) ||
        pkg.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get packages by category
   */
  getPackagesByCategory(category: string): MCPServerPackage[] {
    // Categories based on package names
    const categories: Record<string, string[]> = {
      database: ['postgres', 'sqlite'],
      search: ['brave-search', 'google-maps'],
      development: ['github', 'filesystem', 'puppeteer'],
      communication: ['slack'],
      ai: ['memory', 'sequential-thinking'],
    };

    const packageNames = categories[category];
    if (!packageNames) {
      return [];
    }

    return packageNames
      .map((name) => this.packages.get(name))
      .filter((pkg): pkg is MCPServerPackage => pkg !== undefined);
  }

  /**
   * Get installation instructions for a package
   */
  getInstallInstructions(packageName: string): string {
    const pkg = this.packages.get(packageName);
    if (!pkg) {
      return `Package not found: ${packageName}`;
    }

    const lines: string[] = [
      `# Installing ${pkg.name}`,
      '',
      `## Package: ${pkg.npmPackage}`,
      `## Version: ${pkg.version}`,
      '',
      `## Description`,
      pkg.description,
      '',
    ];

    if (pkg.envVars && pkg.envVars.length > 0) {
      lines.push('## Required Environment Variables');
      for (const varName of pkg.envVars) {
        lines.push(`- ${varName}`);
      }
      lines.push('');
    }

    lines.push('## Installation');
    lines.push('```bash');
    lines.push(`npx ${pkg.npmPackage}`);
    lines.push('```');
    lines.push('');

    lines.push('## Configuration (YAML)');
    lines.push('```yaml');
    lines.push(`mcpServers:`);
    lines.push(`  ${pkg.name}:`);
    lines.push(`    command: npx`);
    lines.push(`    args:`);
    lines.push(`      - '-y'`);
    lines.push(`      - '${pkg.npmPackage}'`);
    if (pkg.envVars && pkg.envVars.length > 0) {
      lines.push(`    env:`);
      for (const varName of pkg.envVars) {
        lines.push(`      ${varName}: \${${varName}}`);
      }
    }
    lines.push('```');

    return lines.join('\n');
  }
}

// Singleton instance
let defaultRegistry: MCPRegistry | null = null;

/**
 * Get the default registry instance
 */
export function getDefaultMCPRegistry(): MCPRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new MCPRegistry();
  }
  return defaultRegistry;
}

/**
 * Create a new registry instance
 */
export function createMCPRegistry(): MCPRegistry {
  return new MCPRegistry();
}
