import chalk from 'chalk';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function errorCorrectFallback(text: string): Promise<void> {
  const chars = text.split('');
  const len = chars.length;
  process.stdout.write('\n');
  for (let i = 0; i < len; i++) {
    const ratio = i / Math.max(len - 1, 1);
    // Transition from red to green as ratio goes 0 → 1
    const r = Math.round(255 * (1 - ratio));
    const g = Math.round(255 * ratio);
    const char = chars[i] ?? '';
    process.stdout.write(chalk.rgb(r, g, 0)(char));
    await sleep(20);
  }
  process.stdout.write('\n');
}

export async function printFallback(text: string): Promise<void> {
  process.stdout.write('\n');
  for (const char of text) {
    process.stdout.write(chalk.green(char));
    await sleep(30);
  }
  process.stdout.write('\n');
}

export async function thunderstormFallback(text: string): Promise<void> {
  process.stdout.write('\n');
  const flashes = 6;
  for (let i = 0; i < flashes; i++) {
    const isBlue = i % 2 === 0;
    if (isBlue) {
      process.stdout.write('\r' + chalk.blueBright(text));
    } else {
      process.stdout.write('\r' + chalk.whiteBright(text));
    }
    await sleep(120);
  }
  process.stdout.write('\n');
}

export async function spotlightsFallback(text: string): Promise<void> {
  process.stdout.write('\n');
  const len = text.length;
  const spotlightWidth = Math.max(3, Math.floor(len / 5));

  for (let pos = -spotlightWidth; pos < len + spotlightWidth; pos += 2) {
    let line = '';
    for (let i = 0; i < len; i++) {
      const char = text[i] ?? '';
      const dist = Math.abs(i - pos);
      if (dist <= spotlightWidth) {
        line += chalk.bold.yellowBright(char);
      } else {
        line += chalk.dim(char);
      }
    }
    process.stdout.write('\r' + line);
    await sleep(40);
  }
  process.stdout.write('\n');
}
