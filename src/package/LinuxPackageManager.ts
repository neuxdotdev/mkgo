import fs from 'fs-extra'
import path from 'path'
import { execa } from 'execa'
import { Logger } from '../core/Logger.js'

export interface DebOptions {
  name: string
  version: string
  description: string
  maintainer: string
  arch: string
  dependencies?: string[]
  installDir?: string
}

export interface RpmOptions {
  name: string
  version: string
  release: string
  summary: string
  license: string
  arch: string
  requires?: string[]
}

export class LinuxPackageManager {
  static async createDEB(
    binaryPath: string,
    outputDir: string,
    options: DebOptions
  ): Promise<string> {
    const debName = `${options.name}_${options.version}_${options.arch}.deb`
    const debPath = path.join(outputDir, debName)
    const tempDir = path.join(outputDir, 'deb_temp')

    await fs.ensureDir(tempDir)

    // DEB package structure
    const debianDir = path.join(tempDir, 'DEBIAN')
    const installDir = options.installDir || '/usr/bin'
    const binaryDir = path.join(tempDir, installDir.replace(/^\//, ''))

    await fs.ensureDir(debianDir)
    await fs.ensureDir(binaryDir)

    // Copy binary
    await fs.copy(binaryPath, path.join(binaryDir, options.name))
    await fs.chmod(path.join(binaryDir, options.name), 0o755)

    // Create control file
    const controlFile = `Package: ${options.name}
Version: ${options.version}
Architecture: ${options.arch}
Maintainer: ${options.maintainer}
Description: ${options.description}
${options.dependencies ? `Depends: ${options.dependencies.join(', ')}` : ''}
`

    await fs.writeFile(path.join(debianDir, 'control'), controlFile)

    // Build DEB package
    await execa('dpkg-deb', ['--build', tempDir, debPath])

    // Cleanup
    await fs.remove(tempDir)

    Logger.success(`DEB package created: ${debPath}`)
    return debPath
  }

  static async createRPM(
    binaryPath: string,
    outputDir: string,
    options: RpmOptions
  ): Promise<string> {
    const rpmName = `${options.name}-${options.version}-${options.release}.${options.arch}.rpm`
    const rpmPath = path.join(outputDir, rpmName)
    const tempDir = path.join(outputDir, 'rpm_temp')
    const rpmBuildDir = path.join(tempDir, 'rpmbuild')

    await fs.ensureDir(rpmBuildDir)

    // RPM directory structure
    const dirs = ['BUILD', 'RPMS', 'SOURCES', 'SPECS', 'SRPMS', 'BUILDROOT']

    for (const dir of dirs) {
      await fs.ensureDir(path.join(rpmBuildDir, dir))
    }

    // Copy binary to build directory
    const buildRootDir = path.join(
      rpmBuildDir,
      'BUILDROOT',
      `${options.name}-${options.version}-${options.release}.${options.arch}`
    )
    const usrBinDir = path.join(buildRootDir, 'usr/bin')
    await fs.ensureDir(usrBinDir)

    await fs.copy(binaryPath, path.join(usrBinDir, options.name))
    await fs.chmod(path.join(usrBinDir, options.name), 0o755)

    // Create spec file
    const specFile = `Name: ${options.name}
Version: ${options.version}
Release: ${options.release}
Summary: ${options.summary}
License: ${options.license}
BuildArch: ${options.arch}

%description
${options.summary}

%files
/usr/bin/${options.name}

%changelog
* ${new Date().toUTCString()} - ${options.name} ${options.version}
- Initial package
`

    const specPath = path.join(rpmBuildDir, 'SPECS', `${options.name}.spec`)
    await fs.writeFile(specPath, specFile)

    // Build RPM (simplified - in production you'd use rpmbuild)
    try {
      await execa('rpmbuild', ['-bb', '--define', `_topdir ${rpmBuildDir}`, specPath])

      // Find and copy the built RPM
      const rpmsDir = path.join(rpmBuildDir, 'RPMS', options.arch)
      const builtRpms = await fs.readdir(rpmsDir)
      const builtRpm = builtRpms.find(f => f.endsWith('.rpm'))

      if (builtRpm) {
        await fs.copy(path.join(rpmsDir, builtRpm), rpmPath)
      }
    } catch (error) {
      Logger.warn('RPM build failed, creating simple archive instead')
      // Fallback to tar.gz if rpmbuild is not available
      return this.createFallbackRPM(binaryPath, outputDir, options)
    } finally {
      await fs.remove(tempDir)
    }

    Logger.success(`RPM package created: ${rpmPath}`)
    return rpmPath
  }

  private static async createFallbackRPM(
    binaryPath: string,
    outputDir: string,
    options: RpmOptions
  ): Promise<string> {
    const { ArchiveManager } = await import('./ArchiveManager.js')
    return ArchiveManager.createArchive(
      binaryPath,
      outputDir,
      {
        format: 'tar.gz',
        includeChecksums: true,
      },
      {
        name: options.name,
        version: options.version,
        description: options.summary,
        license: options.license,
      }
    )
  }
}
