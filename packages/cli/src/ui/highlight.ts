
/**
 * Syntax highlighting UI component
 * Highlights code blocks in the terminal
 */

import hljs from 'highlight.js';
import chalk from 'chalk';

/**
 * Supported languages for syntax highlighting
 */
const SUPPORTED_LANGUAGES = [
  'typescript', 'javascript', 'python', 'java', 'c', 'cpp', 'csharp',
  'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala',
  'html', 'css', 'scss', 'less', 'json', 'yaml', 'xml',
  'markdown', 'bash', 'shell', 'sql', 'graphql', 'dockerfile',
  'typescriptreact', 'javascriptreact', 'vue', 'svelte',
];

/**
 * Highlight code with syntax highlighting
 */
export function highlightCode(code: string, language?: string): string {
  try {
    if (language && SUPPORTED_LANGUAGES.includes(language.toLowerCase())) {
      const result = hljs.highlight(code, { language: language.toLowerCase() });
      return result.value;
    }
    
    // Auto-detect language
    const result = hljs.highlightAuto(code);
    return result.value;
  } catch {
    // If highlighting fails, return original code
    return code;
  }
}

/**
 * Highlight code with line numbers
 */
export function highlightWithLineNumbers(code: string, language?: string): string {
  const lines = code.split('\n');
  const lineCount = lines.length;
  const maxLineNumWidth = lineCount.toString().length;
  
  const highlighted = language 
    ? highlightCode(code, language)
    : code;
  
  const highlightedLines = highlighted.split('\n');
  
  return highlightedLines
    .map((line, i) => {
      const lineNum = (i + 1).toString().padStart(maxLineNumWidth);
      return chalk.dim(`${lineNum} │ `) + line;
    })
    .join('\n');
}

/**
 * Highlight JSON
 */
export function highlightJSON(json: string | object): string {
  const jsonString = typeof json === 'string' ? json : JSON.stringify(json, null, 2);
  
  return jsonString
    .replace(/"([^"]+)":/g, chalk.cyan('"$1":'))
    .replace(/: "([^"]+)"/g, ': ' + chalk.green('"$1"'))
    .replace(/: (\d+)/g, ': ' + chalk.yellow('$1'))
    .replace(/: (true|false)/g, ': ' + chalk.magenta('$1'))
    .replace(/: (null)/g, ': ' + chalk.dim('$1'));
}

/**
 * Format JSON with syntax highlighting (alias for highlightJSON)
 */
export const formatJSON = highlightJSON;

/**
 * Highlight diff output
 */
export function highlightDiff(diff: string): string {
  const lines = diff.split('\n');
  
  return lines
    .map(line => {
      if (line.startsWith('+')) {
        return chalk.green(line);
      }
      if (line.startsWith('-')) {
        return chalk.red(line);
      }
      if (line.startsWith('@@')) {
        return chalk.cyan(line);
      }
      if (line.startsWith('diff --git') || line.startsWith('index ')) {
        return chalk.dim(line);
      }
      return line;
    })
    .join('\n');
}

/**
 * Highlight error message
 */
export function highlightError(error: string): string {
  return error
    .replace(/Error:/g, chalk.red.bold('Error:'))
    .replace(/Warning:/g, chalk.yellow.bold('Warning:'))
    .replace(/at\s+(.+?)\s*\(/g, 'at ' + chalk.cyan('$1') + ' (')
    .replace(/\((.+?):(\d+):(\d+)\)/g, '(' + chalk.dim('$1') + ':' + chalk.yellow('$2') + ':' + chalk.yellow('$3') + ')');
}

/**
 * Highlight file path
 */
export function highlightPath(path: string): string {
  const parts = path.split('/');
  const fileName = parts.pop() || '';
  
  return chalk.dim(parts.join('/') + '/') + chalk.white(fileName);
}

/**
 * Highlight URL
 */
export function highlightURL(url: string): string {
  try {
    const parsed = new URL(url);
    return chalk.dim(parsed.protocol + '//') + 
           chalk.cyan(parsed.host) + 
           chalk.white(parsed.pathname) + 
           (parsed.search ? chalk.dim(parsed.search) : '');
  } catch {
    return url;
  }
}

/**
 * Get language from file extension
 */
export function getLanguageFromExtension(filename: string): string | undefined {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const extensionMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescriptreact',
    'js': 'javascript',
    'jsx': 'javascriptreact',
    'py': 'python',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'kt': 'kotlin',
    'swift': 'swift',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'php': 'php',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'md': 'markdown',
    'sh': 'bash',
    'bash': 'bash',
    'sql': 'sql',
    'graphql': 'graphql',
    'gql': 'graphql',
    'vue': 'vue',
    'svelte': 'svelte',
  };
  
  return ext ? extensionMap[ext] : undefined;
}

/**
 * Create a code block with header
 */
export function createCodeBlock(code: string, language?: string, filename?: string): string {
  const header = filename 
    ? chalk.dim('┌─ ') + chalk.cyan(filename) + chalk.dim(' ' + '─'.repeat(40 - filename.length))
    : language 
      ? chalk.dim('┌─ ') + chalk.cyan(language) + chalk.dim(' ' + '─'.repeat(40 - language.length))
      : chalk.dim('┌' + '─'.repeat(44));
  
  const footer = chalk.dim('└' + '─'.repeat(44));
  
  const highlighted = language ? highlightCode(code, language) : code;
  
  return `${header}\n${highlighted}\n${footer}`;
}
