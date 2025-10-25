import { execa } from "execa";
import fs from "fs-extra";
import os from "os";
import path from "path";

import { ChecksumUtil } from "../core/ChecksumUtil.js";
import { GoUtils } from "../core/GoUtils.js";
import { Logger } from "../core/Logger.js";
import {
  type BuildConfig,
  type BuildTarget,
  type BuildResult,
} from "./../types.js";
import { BuildCache } from "./BuildCache.js";
export class GoBuilder {
  private buildCache: BuildCache;
  private builtBinaries: string[] = [];
  private checksumFiles: string[] = [];
  private failedBuilds: string[] = [];
  constructor() {
    this.buildCache = new BuildCache();
  }
  async build(config: BuildConfig): Promise<BuildResult> {
    const startTime = Date.now();
    try {
      Logger.info(`🚀 Building ${config.targets.length} platforms`);
      if (!(await GoUtils.validateGoProject())) {
        throw new Error("Not a Go project (go.mod not found)");
      }
      if (config.clean) {
        await this.cleanBuildDir(config.outputDir);
        await this.buildCache.cleanCache();
      }
      await fs.ensureDir(config.outputDir);
      await this.buildTargetsParallel(config);
      if (config.checksum && this.builtBinaries.length > 0) {
        await this.generateChecksums(config);
      }
      const duration = Date.now() - startTime;
      return this.createBuildResult(duration);
    } catch (error) {
      throw error;
    }
  }
  private async buildTargetsParallel(config: BuildConfig): Promise<void> {
    const parallelLimit = Math.min(config.parallel, os.cpus().length);
    const batches: BuildTarget[][] = [];
    for (let i = 0; i < config.targets.length; i += parallelLimit) {
      batches.push(config.targets.slice(i, i + parallelLimit));
    }
    for (const batch of batches) {
      await Promise.allSettled(
        batch.map((target) => this.buildTargetWithCache(target, config)),
      );
    }
  }
  private async buildTargetWithCache(
    target: BuildTarget,
    config: BuildConfig,
  ): Promise<void> {
    try {
      const cacheKey = await this.buildCache.getCacheKey(target, config);
      const cacheHit = await this.buildCache.restoreFromCache(
        cacheKey,
        target.output,
      );
      if (cacheHit) {
        this.builtBinaries.push(target.output);
        Logger.success(`Cached: ${path.basename(target.output)}`);
        return;
      }
      Logger.verbose(`Building: ${target.platform} -> ${target.output}`);
      await this.executeGoBuild(target, config);
      await this.buildCache.saveToCache(cacheKey, target.output);
      this.builtBinaries.push(target.output);
      Logger.success(`Built: ${path.basename(target.output)}`);
    } catch (error) {
      this.failedBuilds.push(target.platform);
      Logger.error(`Failed ${target.platform}: ${error}`);
    }
  }
  private async executeGoBuild(
    target: BuildTarget,
    config: BuildConfig,
  ): Promise<void> {
    const args = this.buildGoArgs(target, config);
    await execa("go", args, {
      env: {
        GOOS: target.os,
        GOARCH: target.arch,
        CGO_ENABLED: config.cgo ? "1" : "0",
        ...process.env,
      },
      timeout: config.timeout * 1000,
    });
    if (target.os !== "windows") {
      await fs.chmod(target.output, 0o755);
    }
  }
  private buildGoArgs(target: BuildTarget, config: BuildConfig): string[] {
    const args: string[] = ["build", "-o", target.output];
    const ldflags: string[] = [
      `-X main.Version=${config.version}`,
      `-X main.BuildDate=${config.timestamp}`,
      `-X main.CommitHash=${config.gitHash}`,
      "-s",
      "-w",
    ];
    if (config.ldflags) {
      const extraFlags = config.ldflags.split(/\s+/).filter(Boolean);
      ldflags.push(...extraFlags);
    }
    args.push("-ldflags", ldflags.join(" "));
    if (config.tags && config.tags.length > 0) {
      args.push("-tags", config.tags.join(","));
    }
    if (config.race) {
      args.push("-race");
    }
    args.push("-trimpath");
    if (config.debug) {
      args.push("-gcflags", "all=-N -l");
    }
    args.push(".");
    return args;
  }
  private async generateChecksums(config: BuildConfig): Promise<void> {
    this.checksumFiles = await ChecksumUtil.writeChecksumFiles(
      this.builtBinaries,
      config.outputDir,
    );
    Logger.success("Checksums generated");
  }
  private async cleanBuildDir(outputDir: string): Promise<void> {
    if (await fs.pathExists(outputDir)) {
      await fs.remove(outputDir);
      Logger.info("Cleaned build directory");
    }
  }
  private createBuildResult(duration: number): BuildResult {
    return {
      success: this.failedBuilds.length === 0,
      binaries: this.builtBinaries,
      checksums: this.checksumFiles,
      failed: this.failedBuilds,
      duration,
    };
  }
}
