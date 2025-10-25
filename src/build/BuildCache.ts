import fs from 'fs-extra'
import crypto from 'crypto'
import path from 'path'
import { execa } from 'execa'
import { type BuildConfig, type BuildTarget } from './../types.js'
import { Logger } from '../core/Logger.js'
export class BuildCache {
  private cacheDir = '.mkgo-cache'
  async getCacheKey(target: BuildTarget, config: BuildConfig): Promise<string> {
    const sourceHash = await this.calculateSourceHash()
    const configHash = crypto.createHash('md5').update(JSON.stringify(config)).digest('hex')
    return `${target.platform}-${sourceHash}-${configHash}`
  }
  private async calculateSourceHash(): Promise<string> {
    try {
      const { stdout } = await execa('find', ['.', '-name', '*.go', '-type', 'f'])
      const goFiles = stdout.split('\n').filter(f => f.trim())
      const hash = crypto.createHash('md5')
      for (const file of goFiles) {
        if (await fs.pathExists(file)) {
          const content = await fs.readFile(file)
          hash.update(content)
        }
      }
      return hash.digest('hex').slice(0, 12)
    } catch {
      return 'unknown'
    }
  }
  async restoreFromCache(cacheKey: string, outputPath: string): Promise<boolean> {
    const cacheFile = path.join(this.cacheDir, `${cacheKey}.bin`)
    try {
      if (await fs.pathExists(cacheFile)) {
        await fs.copy(cacheFile, outputPath)
        Logger.info(`Cache hit: ${path.basename(outputPath)}`)
        return true
      }
      return false
    } catch {
      return false
    }
  }
  async saveToCache(cacheKey: string, binaryPath: string): Promise<void> {
    await fs.ensureDir(this.cacheDir)
    const cacheFile = path.join(this.cacheDir, `${cacheKey}.bin`)
    await fs.copy(binaryPath, cacheFile)
  }
  async cleanCache(): Promise<void> {
    if (await fs.pathExists(this.cacheDir)) {
      await fs.remove(this.cacheDir)
      Logger.info('Build cache cleaned')
    }
  }
}
