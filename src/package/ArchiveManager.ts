import archiver from "archiver";
import { execa } from "execa";
import fs from "fs-extra";
import path from "path";

import { ChecksumUtil } from "../core/ChecksumUtil.js";
import { Logger } from "../core/Logger.js";
export interface ArchiveOptions {
  format: "zip" | "tar.gz" | "tar.xz" | "tar.bz2";
  compressLevel?: number;
  includeChecksums?: boolean;
  includeSource?: boolean;
}
export interface PackageInfo {
  name: string;
  version: string;
  description?: string;
  maintainer?: string;
  license?: string;
  dependencies?: string[];
}
export class ArchiveManager {
  static async createArchive(
    binaryPath: string,
    outputDir: string,
    options: ArchiveOptions,
    packageInfo?: PackageInfo,
  ): Promise<string> {
    await fs.ensureDir(outputDir);
    const binaryName = path.basename(binaryPath);
    const baseName = binaryName.replace(path.extname(binaryName), "");
    const archiveName = `${baseName}-${options.format}`;
    const archivePath = path.join(outputDir, archiveName);
    Logger.info(`Creating ${options.format} archive: ${archiveName}`);
    const output = fs.createWriteStream(archivePath);
    const archive = this.createArchiver(options.format, options.compressLevel);
    return new Promise((resolve, reject) => {
      output.on("close", () => {
        Logger.success(
          `Archive created: ${archivePath} (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`,
        );
        resolve(archivePath);
      });
      archive.on("error", (err) => {
        reject(err);
      });
      archive.pipe(output);
      archive.file(binaryPath, { name: binaryName });
      if (options.includeChecksums) {
        this.addChecksumsToArchive(archive, binaryPath, binaryName);
      }
      if (packageInfo) {
        this.addPackageMetadata(archive, packageInfo);
      }
      if (options.includeSource) {
        this.addSourceCodeToArchive(archive);
      }
      archive.finalize();
    });
  }
  private static createArchiver(
    format: string,
    compressLevel: number = 9,
  ): archiver.Archiver {
    switch (format) {
      case "zip":
        return archiver("zip", { zlib: { level: compressLevel } });
      case "tar.gz":
        return archiver("tar", {
          gzip: true,
          gzipOptions: { level: compressLevel },
        });
      case "tar.xz":
        return archiver("tar", {});
      case "tar.bz2":
        return archiver("tar", {});
      default:
        return archiver("zip", { zlib: { level: compressLevel } });
    }
  }
  private static async addChecksumsToArchive(
    archive: archiver.Archiver,
    binaryPath: string,
    binaryName: string,
  ): Promise<void> {
    try {
      const checksum = await ChecksumUtil.generateChecksum(binaryPath);
      archive.append(`${checksum}  ${binaryName}\n`, { name: "SHA256SUMS" });
    } catch (error) {
      Logger.warn("Failed to generate checksum for archive");
    }
  }
  private static addPackageMetadata(
    archive: archiver.Archiver,
    packageInfo: PackageInfo,
  ): void {
    const metadata = {
      name: packageInfo.name,
      version: packageInfo.version,
      description: packageInfo.description || "",
      maintainer: packageInfo.maintainer || "unknown",
      license: packageInfo.license || "MIT",
      dependencies: packageInfo.dependencies || [],
      build_date: new Date().toISOString(),
    };
    archive.append(JSON.stringify(metadata, null, 2), { name: "package.json" });
  }
  private static async addSourceCodeToArchive(
    archive: archiver.Archiver,
  ): Promise<void> {
    try {
      const goFiles = await this.findGoFiles(".");
      for (const file of goFiles) {
        archive.file(file, { name: `src/${file}` });
      }
      if (await fs.pathExists("go.mod")) {
        archive.file("go.mod", { name: "src/go.mod" });
      }
      if (await fs.pathExists("go.sum")) {
        archive.file("go.sum", { name: "src/go.sum" });
      }
    } catch (error) {
      Logger.warn("Failed to include source code in archive");
    }
  }
  private static async findGoFiles(dir: string): Promise<string[]> {
    try {
      const { stdout } = await execa("find", [
        dir,
        "-name",
        "*.go",
        "-type",
        "f",
      ]);
      return stdout.split("\n").filter((file) => file.trim());
    } catch {
      return [];
    }
  }
  static async createDMG(
    binaryPath: string,
    outputDir: string,
    appName: string,
    version: string,
  ): Promise<string> {
    if (process.platform !== "darwin") {
      throw new Error("DMG creation is only supported on macOS");
    }
    const dmgName = `${appName}-${version}.dmg`;
    const dmgPath = path.join(outputDir, dmgName);
    const tempDir = path.join(outputDir, "temp_dmg");
    await fs.ensureDir(tempDir);
    const appDir = path.join(tempDir, `${appName}.app`);
    const contentsDir = path.join(appDir, "Contents");
    const macosDir = path.join(contentsDir, "MacOS");
    const resourcesDir = path.join(contentsDir, "Resources");
    await fs.ensureDir(macosDir);
    await fs.ensureDir(resourcesDir);
    await fs.copy(binaryPath, path.join(macosDir, appName));
    await fs.chmod(path.join(macosDir, appName), 0o755);
    const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>${appName}</string>
    <key>CFBundleIdentifier</key>
    <string>com.${appName.toLowerCase()}.app</string>
    <key>CFBundleName</key>
    <string>${appName}</string>
    <key>CFBundleVersion</key>
    <string>${version}</string>
    <key>CFBundleShortVersionString</key>
    <string>${version}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>CFBundleDevelopmentRegion</key>
    <string>English</string>
</dict>
</plist>`;
    await fs.writeFile(path.join(contentsDir, "Info.plist"), infoPlist);
    await execa("hdiutil", [
      "create",
      "-volname",
      appName,
      "-srcfolder",
      tempDir,
      "-ov",
      "-format",
      "UDZO",
      dmgPath,
    ]);
    await fs.remove(tempDir);
    Logger.success(`DMG created: ${dmgPath}`);
    return dmgPath;
  }
}
