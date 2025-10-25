import fs from 'fs-extra'
import crypto from 'crypto'
import path from 'path'
export class ChecksumUtil {
  static async generateChecksum(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath)
    const hash = crypto.createHash('sha256')
    hash.update(fileBuffer)
    return hash.digest('hex')
  }
  static async writeChecksumFiles(binaries: string[], outputDir: string): Promise<string[]> {
    const checksums: string[] = []
    const individualDir = path.join(outputDir, 'checksums')
    await fs.ensureDir(individualDir)
    for (const binary of binaries) {
      const checksum = await this.generateChecksum(binary)
      const filename = path.basename(binary)
      checksums.push(`${checksum}  ${filename}`)
    }
    const checksumFile = path.join(outputDir, 'checksums.txt')
    await fs.writeFile(checksumFile, checksums.join('\n'))
    for (const binary of binaries) {
      const checksum = await this.generateChecksum(binary)
      const filename = path.basename(binary)
      const individualFile = path.join(individualDir, `${filename}.sha256`)
      await fs.writeFile(individualFile, checksum)
    }
    return [
      checksumFile,
      ...binaries.map(b => path.join(individualDir, `${path.basename(b)}.sha256`)),
    ]
  }
}
