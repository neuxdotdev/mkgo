import fs from 'fs-extra'
import path from 'path'
import { execa } from 'execa'
import { Logger } from '../core/Logger.js'

export interface WindowsInstallerOptions {
  name: string
  version: string
  publisher: string
  description: string
  icon?: string
  license?: string
  installDir?: string
}

export class WindowsInstaller {
  static async createMSI(
    binaryPath: string,
    outputDir: string,
    options: WindowsInstallerOptions
  ): Promise<string> {
    const msiName = `${options.name}-${options.version}.msi`
    const msiPath = path.join(outputDir, msiName)
    const tempDir = path.join(outputDir, 'msi_temp')

    await fs.ensureDir(tempDir)

    // Create WiX configuration
    const wxsContent = this.generateWixConfig(binaryPath, options)
    const wxsPath = path.join(tempDir, 'installer.wxs')
    await fs.writeFile(wxsPath, wxsContent)

    try {
      // Compile WiX source (requires WiX Toolset installed)
      await execa('candle', [wxsPath, '-o', tempDir], {
        cwd: tempDir,
      })

      const wixobjPath = path.join(tempDir, 'installer.wixobj')

      // Link to create MSI
      await execa('light', [wixobjPath, '-out', msiPath, '-ext', 'WixUIExtension'], {
        cwd: tempDir,
      })

      Logger.success(`MSI installer created: ${msiPath}`)
      return msiPath
    } catch (error) {
      Logger.warn('WiX Toolset not available, creating ZIP archive instead')
      return this.createFallbackInstaller(binaryPath, outputDir, options)
    } finally {
      await fs.remove(tempDir)
    }
  }

  static async createEXE(
    binaryPath: string,
    outputDir: string,
    options: WindowsInstallerOptions
  ): Promise<string> {
    const exeName = `${options.name}-Setup-${options.version}.exe`
    const exePath = path.join(outputDir, exeName)
    const tempDir = path.join(outputDir, 'exe_temp')

    await fs.ensureDir(tempDir)

    // For EXE installers, we'll use Inno Setup script
    const issContent = this.generateInnoSetupScript(binaryPath, options)
    const issPath = path.join(tempDir, 'installer.iss')
    await fs.writeFile(issPath, issContent)

    try {
      // Compile Inno Setup script (requires Inno Setup installed)
      await execa('iscc', [issPath], {
        cwd: tempDir,
      })

      // Copy the built installer
      const builtInstaller = path.join(tempDir, 'Output', 'installer.exe')
      if (await fs.pathExists(builtInstaller)) {
        await fs.copy(builtInstaller, exePath)
      }

      Logger.success(`EXE installer created: ${exePath}`)
      return exePath
    } catch (error) {
      Logger.warn('Inno Setup not available, creating ZIP archive instead')
      return this.createFallbackInstaller(binaryPath, outputDir, options)
    } finally {
      await fs.remove(tempDir)
    }
  }

  private static generateWixConfig(binaryPath: string, options: WindowsInstallerOptions): string {

    return `<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
    <Product Id="*" Name="${options.name}" Language="1033"
             Version="${options.version}" Manufacturer="${options.publisher}"
             UpgradeCode="YOUR-GUID-HERE">
        <Package InstallerVersion="200" Compressed="yes" InstallScope="perMachine" />

        <MajorUpgrade DowngradeErrorMessage="A newer version of [ProductName] is already installed." />
        <MediaTemplate EmbedCab="yes" />

        <Feature Id="ProductFeature" Title="${options.name}" Level="1">
            <ComponentRef Id="ApplicationFiles" />
        </Feature>

        <Directory Id="TARGETDIR" Name="SourceDir">
            <Directory Id="ProgramFilesFolder">
                <Directory Id="INSTALLFOLDER" Name="${options.name}" />
            </Directory>
        </Directory>

        <DirectoryRef Id="INSTALLFOLDER">
            <Component Id="ApplicationFiles" Guid="YOUR-GUID-HERE">
                <File Id="ApplicationFile" Source="${binaryPath}" KeyPath="yes" />
            </Component>
        </DirectoryRef>

        <UI>
            <UIRef Id="WixUI_FeatureTree" />
            <UIRef Id="WixUI_ErrorProgressText" />
        </UI>
    </Product>
</Wix>`
  }

  private static generateInnoSetupScript(
    binaryPath: string,
    options: WindowsInstallerOptions
  ): string {
    const binaryName = path.basename(binaryPath)

    return `[Setup]
AppName=${options.name}
AppVersion=${options.version}
AppPublisher=${options.publisher}
AppPublisherURL=https://example.com
AppSupportURL=https://example.com/support
AppUpdatesURL=https://example.com/updates
DefaultDirName={pf}\\${options.name}
DefaultGroupName=${options.name}
OutputDir=Output
OutputBaseFilename=installer
Compression=lzma
SolidCompression=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "${binaryPath}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\\${options.name}"; Filename: "{app}\\${binaryName}"
Name: "{autodesktop}\\${options.name}"; Filename: "{app}\\${binaryName}"; Tasks: desktopicon

[Run]
Filename: "{app}\\${binaryName}"; Description: "{cm:LaunchProgram,${options.name}}"; Flags: nowait postinstall skipifsilent
`
  }

  private static async createFallbackInstaller(
    binaryPath: string,
    outputDir: string,
    options: WindowsInstallerOptions
  ): Promise<string> {
    const { ArchiveManager } = await import('./ArchiveManager.js')
    return ArchiveManager.createArchive(
      binaryPath,
      outputDir,
      {
        format: 'zip',
        includeChecksums: true,
      },
      {
        name: options.name,
        version: options.version,
        description: options.description,
      }
    )
  }
}
