/**
 * Code manipulation tool
 */

import type { Tool, ToolResult, JSONSchema } from '../types.js';

/**
 * Code tool configuration
 */
export interface CodeToolConfig {
  /** Default language for code generation */
  readonly defaultLanguage?: string;
  /** Maximum code length */
  readonly maxCodeLength?: number;
}

/**
 * Code operation parameters
 */
interface CodeAnalyzeParams {
  readonly operation: 'analyze_code';
  readonly code: string;
  readonly language?: string;
}

interface CodeRefactorParams {
  readonly operation: 'refactor_code';
  readonly code: string;
  readonly instructions: string;
  readonly language?: string;
}

interface CodeGenerateParams {
  readonly operation: 'generate_code';
  readonly description: string;
  readonly language?: string;
  readonly context?: string;
}

type CodeParams = CodeAnalyzeParams | CodeRefactorParams | CodeGenerateParams;

/**
 * Code tool for code analysis, refactoring, and generation
 */
export class CodeTool implements Tool {
  readonly name = 'code';
  readonly description = 'Code manipulation: analyze, refactor, and generate code';
  readonly parameters: JSONSchema = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['analyze_code', 'refactor_code', 'generate_code'],
        description: 'The code operation to perform',
      },
      code: {
        type: 'string',
        description: 'Code to analyze or refactor',
      },
      language: {
        type: 'string',
        description: 'Programming language',
      },
      instructions: {
        type: 'string',
        description: 'Refactoring instructions',
      },
      description: {
        type: 'string',
        description: 'Description of code to generate',
      },
      context: {
        type: 'string',
        description: 'Additional context for code generation',
      },
    },
    required: ['operation'],
  };

  private readonly defaultLanguage: string;
  private readonly maxCodeLength: number;

  constructor(config: CodeToolConfig = {}) {
    this.defaultLanguage = config.defaultLanguage ?? 'typescript';
    this.maxCodeLength = config.maxCodeLength ?? 100000; // 100KB
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const codeParams = params as unknown as CodeParams;

    // Validate code length if present
    const code = (codeParams as { code?: string }).code;
    if (code && code.length > this.maxCodeLength) {
      return {
        success: false,
        output: null,
        error: `Code too long: ${code.length} characters (max: ${this.maxCodeLength})`,
      };
    }

    try {
      switch (codeParams.operation) {
        case 'analyze_code':
          return await this.analyzeCode(codeParams);
        case 'refactor_code':
          return await this.refactorCode(codeParams);
        case 'generate_code':
          return await this.generateCode(codeParams);
        default:
          return {
            success: false,
            output: null,
            error: `Unknown operation: ${(codeParams as { operation: string }).operation}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async analyzeCode(params: CodeAnalyzeParams): Promise<ToolResult> {
    const language = params.language ?? this.defaultLanguage;
    const code = params.code;

    if (!code) {
      return {
        success: false,
        output: null,
        error: 'Code is required for analysis',
      };
    }

    // Basic code analysis
    const analysis = {
      language,
      lines: code.split('\n').length,
      characters: code.length,
      functions: this.countFunctions(code, language),
      classes: this.countClasses(code, language),
      imports: this.countImports(code, language),
      comments: this.countComments(code, language),
      complexity: this.calculateComplexity(code),
    };

    return {
      success: true,
      output: analysis,
    };
  }

  private async refactorCode(params: CodeRefactorParams): Promise<ToolResult> {
    const language = params.language ?? this.defaultLanguage;
    const code = params.code;
    const instructions = params.instructions;

    if (!code) {
      return {
        success: false,
        output: null,
        error: 'Code is required for refactoring',
      };
    }

    if (!instructions) {
      return {
        success: false,
        output: null,
        error: 'Instructions are required for refactoring',
      };
    }

    // Return refactoring request info (actual refactoring would be done by LLM)
    return {
      success: true,
      output: {
        language,
        originalCode: code,
        instructions,
        message: 'Refactoring request prepared. Use an LLM to perform the actual refactoring.',
      },
    };
  }

  private async generateCode(params: CodeGenerateParams): Promise<ToolResult> {
    const language = params.language ?? this.defaultLanguage;
    const description = params.description;
    const context = params.context;

    if (!description) {
      return {
        success: false,
        output: null,
        error: 'Description is required for code generation',
      };
    }

    // Return generation request info (actual generation would be done by LLM)
    return {
      success: true,
      output: {
        language,
        description,
        context,
        message: 'Code generation request prepared. Use an LLM to generate the actual code.',
      },
    };
  }

  private countFunctions(code: string, language: string): number {
    const patterns: Record<string, RegExp> = {
      typescript: /(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\(|=>\s*{)/g,
      javascript: /(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\(|=>\s*{)/g,
      python: /def\s+\w+/g,
      java: /(?:public|private|protected)?\s*(?:static)?\s*\w+\s+\w+\s*\(/g,
      go: /func\s+\w+/g,
      rust: /fn\s+\w+/g,
    };

    const pattern = patterns[language] ?? patterns.typescript!;
    const matches = code.match(pattern);
    return matches ? matches.length : 0;
  }

  private countClasses(code: string, language: string): number {
    const patterns: Record<string, RegExp> = {
      typescript: /class\s+\w+/g,
      javascript: /class\s+\w+/g,
      python: /class\s+\w+/g,
      java: /class\s+\w+/g,
      go: /struct\s+\w+/g,
      rust: /struct\s+\w+/g,
    };

    const pattern = patterns[language] ?? patterns.typescript!;
    const matches = code.match(pattern);
    return matches ? matches.length : 0;
  }

  private countImports(code: string, language: string): number {
    const patterns: Record<string, RegExp> = {
      typescript: /import\s+.*from\s+['"]/g,
      javascript: /import\s+.*from\s+['"]/g,
      python: /import\s+\w+|from\s+\w+\s+import/g,
      java: /import\s+[\w.]+;/g,
      go: /import\s+/g,
      rust: /use\s+[\w:]+;/g,
    };

    const pattern = patterns[language] ?? patterns.typescript!;
    const matches = code.match(pattern);
    return matches ? matches.length : 0;
  }

  private countComments(code: string, language: string): number {
    const singleLinePatterns: Record<string, RegExp> = {
      typescript: /\/\/.*$/gm,
      javascript: /\/\/.*$/gm,
      python: /#.*$/gm,
      java: /\/\/.*$/gm,
      go: /\/\/.*$/gm,
      rust: /\/\/.*$/gm,
    };

    const multiLinePatterns: Record<string, RegExp> = {
      typescript: /\/\*[\s\S]*?\*\//g,
      javascript: /\/\*[\s\S]*?\*\//g,
      python: /"""[\s\S]*?"""/g,
      java: /\/\*[\s\S]*?\*\//g,
      go: /\/\*[\s\S]*?\*\//g,
      rust: /\/\*[\s\S]*?\*\//g,
    };

    const singlePattern = singleLinePatterns[language] ?? singleLinePatterns.typescript!;
    const multiPattern = multiLinePatterns[language] ?? multiLinePatterns.typescript!;

    const singleMatches = code.match(singlePattern);
    const multiMatches = code.match(multiPattern);

    return (singleMatches ? singleMatches.length : 0) + (multiMatches ? multiMatches.length : 0);
  }

  private calculateComplexity(code: string): number {
    // Simple cyclomatic complexity estimation
    const controlFlowPatterns = [
      /\bif\b/g,
      /\belse\s+if\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\?\s*:/g, // ternary
      /&&/g,
      /\|\|/g,
    ];

    let complexity = 1; // Base complexity
    for (const pattern of controlFlowPatterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }
}

/**
 * Create a code tool with optional configuration
 */
export function createCodeTool(config?: CodeToolConfig): Tool {
  return new CodeTool(config);
}
