/**
 * Markdown rendering UI component
 * Renders markdown in the terminal
 */

import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import chalk from 'chalk';

// Configure marked to use terminal renderer
marked.setOptions({
  renderer: new TerminalRenderer({
    code: chalk.yellow,
    blockquote: chalk.gray.italic,
    html: chalk.gray,
    heading: chalk.green.bold,
    firstHeading: chalk.magenta.bold,
    hr: chalk.dim,
    listitem: chalk.cyan,
    list: chalk.cyan,
    table: chalk.white,
    paragraph: chalk.white,
    strong: chalk.bold,
    em: chalk.italic,
    codespan: chalk.yellow,
    br: chalk.dim,
    link: chalk.blue.underline,
    href: chalk.blue.underline,
    width: process.stdout.columns || 80,
    showSectionPrefix: false,
    tab: 2,
    tableOptions: {},
  }),
});

/**
 * Format markdown text for terminal output
 */
export function formatMarkdown(text: string): string {
  try {
    return marked(text) as string;
  } catch (error) {
    // If parsing fails, return original text
    return text;
  }
}

/**
 * Format code block with syntax highlighting
 */
export function formatCodeBlock(code: string, language?: string): string {
  const header = language 
    ? chalk.dim(`\n┌─ ${language} ─${'─'.repeat(40 - language.length)}\n`)
    : chalk.dim('\n┌' + '─'.repeat(44) + '\n');
  
  const footer = chalk.dim('└' + '─'.repeat(44) + '\n');
  
  return `${header}${chalk.yellow(code)}\n${footer}`;
}

/**
 * Format inline code
 */
export function formatInlineCode(code: string): string {
  return chalk.yellow(`\`${code}\``);
}

/**
 * Format a header
 */
export function formatHeader(text: string, level: number = 1): string {
  const styles = [
    chalk.magenta.bold,
    chalk.green.bold,
    chalk.cyan.bold,
    chalk.blue.bold,
    chalk.white.bold,
    chalk.gray.bold,
  ];
  
  const style = styles[Math.min(level - 1, styles.length - 1)];
  const prefix = '#'.repeat(level) + ' ';
  
  return style(prefix + text);
}

/**
 * Format a list item
 */
export function formatListItem(text: string, ordered: boolean = false, index: number = 0): string {
  const prefix = ordered ? `${index + 1}.` : '•';
  return chalk.cyan(`${prefix} `) + text;
}

/**
 * Format a blockquote
 */
export function formatBlockquote(text: string): string {
  const lines = text.split('\n');
  return lines
    .map(line => chalk.gray.italic(`│ ${line}`))
    .join('\n');
}

/**
 * Format a link
 */
export function formatLink(text: string, url: string): string {
  return `${chalk.blue.underline(text)} ${chalk.dim(`(${url})`)}`;
}

/**
 * Format a table
 */
export function formatTable(headers: string[], rows: string[][]): string {
  const columnWidths = headers.map((h, i) => {
    const maxWidth = Math.max(
      h.length,
      ...rows.map(row => (row[i] || '').length)
    );
    return Math.min(maxWidth, 50);
  });

  const border = {
    top: chalk.dim('┌' + columnWidths.map(w => '─'.repeat(w + 2)).join('┬') + '┐'),
    header: chalk.dim('│'),
    separator: chalk.dim('├' + columnWidths.map(w => '─'.repeat(w + 2)).join('┼') + '┤'),
    row: chalk.dim('│'),
    bottom: chalk.dim('└' + columnWidths.map(w => '─'.repeat(w + 2)).join('┴') + '┘'),
  };

  let result = border.top + '\n';

  // Header row
  result += border.header;
  headers.forEach((h, i) => {
    result += ' ' + chalk.bold(h.padEnd(columnWidths[i])) + ' ' + border.header;
  });
  result += '\n' + border.separator + '\n';

  // Data rows
  for (const row of rows) {
    result += border.row;
    row.forEach((cell, i) => {
      result += ' ' + (cell || '').padEnd(columnWidths[i]) + ' ' + border.row;
    });
    result += '\n';
  }

  result += border.bottom;

  return result;
}

/**
 * Strip markdown formatting
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/^[-*+]\s/gm, '')
    .replace(/^\d+\.\s/gm, '');
}
