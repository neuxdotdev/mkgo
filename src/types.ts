export interface BuildTarget {
  os: string;
  arch: string;
  output: string;
  platform: string;
}
export interface BuildConfig {
  targets: BuildTarget[];
  ldflags: string;
  tags: string[];
  cgo: boolean;
  race: boolean;
  compress: boolean;
  version: string;
  buildVersion: string;
  checksum: boolean;
  clean: boolean;
  debug: boolean;
  verbose: boolean;
  timestamp: string;
  gitHash: string;
  randomHash: string;
  outputDir: string;
  binaryName: string;
  static: boolean;
  strip: boolean;
  timeout: number;
  parallel: number;
  skipTests: boolean;
  skipVerification: boolean;
  noCache?: boolean;
}
export interface CLIOptions {
  target?: string[];
  os?: string[];
  arch?: string[];
  all?: boolean;
  version?: string;
  buildVersion?: string;
  ldflags?: string;
  tags?: string;
  cgo?: boolean;
  race?: boolean;
  compress?: boolean;
  checksum?: boolean;
  clean?: boolean;
  debug?: boolean;
  verbose?: boolean;
  silent?: boolean;
  output?: string;
  name?: string;
  static?: boolean;
  strip?: boolean;
  timeout?: string;
  parallel?: string;
  skipTests?: boolean;
  skipVerification?: boolean;
  listPlatforms?: boolean;
  noCache?: boolean;
  metrics?: boolean;
  benchmark?: boolean;
  config?: string;
  color?: string;
  ci?: boolean;
}
export interface BuildResult {
  success: boolean;
  binaries: string[];
  checksums: string[];
  failed: string[];
  duration: number;
}
export interface CacheMetrics {
  cacheHits: number;
  cacheMisses: number;
  totalTargets: number;
  timeSaved: number;
}
export interface BuildMetrics {
  timestamp: number;
  duration: number;
  targets: number;
  success: boolean;
  cacheEfficiency?: number;
  platform: string;
}
export interface ArchiveOptions {
  format: "zip" | "tar.gz" | "tar.xz" | "tar.bz2" | "dmg";
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
export interface DebOptions {
  name: string;
  version: string;
  description: string;
  maintainer: string;
  arch: string;
  dependencies?: string[];
  installDir?: string;
}
export interface RpmOptions {
  name: string;
  version: string;
  release: string;
  summary: string;
  license: string;
  arch: string;
  requires?: string[];
}
export interface WindowsInstallerOptions {
  name: string;
  version: string;
  publisher: string;
  description: string;
  icon?: string;
  license?: string;
  installDir?: string;
}
export interface DockerOptions {
  name: string;
  version: string;
  port?: number;
  baseImage?: string;
  maintainer?: string;
  labels?: Record<string, string>;
  multiStage?: boolean;
  push?: boolean;
  registry?: string;
  tag?: string;
}
export interface InstallerOptions {
  type: "msi" | "exe" | "pkg" | "deb" | "rpm";
  binary: string;
  output: string;
  name: string;
  version: string;
  publisher?: string;
  description?: string;
}
export interface CleanOptions {
  all?: boolean;
  dist?: boolean;
  cache?: boolean;
  metrics?: boolean;
}
export interface InitOptions {
  name: string;
  module: string;
  output?: string;
  template?: "basic" | "api" | "cli" | "microservice";
}
export interface InfoOptions {
  system?: boolean;
  go?: boolean;
  project?: boolean;
  cache?: boolean;
  all?: boolean;
}
export interface ListOptions {
  platforms?: boolean;
  archs?: boolean;
  templates?: boolean;
  presets?: boolean;
  all?: boolean;
}
export interface CacheOptions {
  clear?: boolean;
  stats?: boolean;
  efficiency?: boolean;
}
export interface MetricsOptions {
  report?: boolean;
  compare?: string;
  trends?: boolean;
}
