import { execa, execaSync } from 'execa'
import fs from 'fs-extra'
import crypto from 'crypto'
export class GoUtils {
  static async getGoVersion(): Promise<string> {
    try {
      const { stdout } = await execa('go', ['version'])
      return stdout.match(/go version go(\d+\.\d+(?:\.\d+)?)/)?.[1] ?? 'unknown'
    } catch {
      return 'unknown'
    }
  }
  static async validateGoProject(): Promise<boolean> {
    try {
      await fs.access('go.mod')
      return true
    } catch {
      return false
    }
  }
  static parseTags(tags?: string): string[] {
    if (!tags) return []
    return tags.split(',').filter(tag => tag.trim().length > 0)
  }
  static generateRandomHash(length: number = 10): string {
    return crypto
      .randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length)
  }
  static getGitHash(): string {
    try {
      const { stdout } = execaSync('git', ['rev-parse', '--short', 'HEAD'])
      return stdout
    } catch {
      return 'unknown'
    }
  }
}
