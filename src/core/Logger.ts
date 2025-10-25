import chalk from 'chalk'
import gradient from 'gradient-string'
import boxen, { type Options } from 'boxen'
export class Logger {
  static success(message: string): void {
    console.log(chalk.green('✓'), message)
  }
  static error(message: string): void {
    console.log(chalk.red('✗'), message)
  }
  static warn(message: string): void {
    console.log(chalk.yellow('!'), message)
  }
  static info(message: string): void {
    console.log(chalk.blue('ℹ'), message)
  }
  static debug(message: string): void {
    console.log(chalk.gray('›'), message)
  }
  static verbose(message: string): void {
    console.log(chalk.gray('↳'), message)
  }
  static gradient(text: string): string {
    return gradient.atlas(text)
  }
  static box(content: string, title?: string): void {
    const options: Options = title
      ? {
          title,
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'blue',
        }
      : {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'blue',
        }
    console.log(boxen(content, options))
  }
}
