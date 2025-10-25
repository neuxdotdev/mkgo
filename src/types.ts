export interface BuildTarget {
  os: string
  arch: string
  output: string
  platform: string
}

export interface BuildConfig {
  targets: BuildTarget[]
  ldflags: string
  tags: string[]
  cgo: boolean
  race: boolean
  compress: boolean
  version: string
  buildVersion: string
  checksum: boolean
  clean: boolean
  debug: boolean
  verbose: boolean
  timestamp: string
  gitHash: string
  randomHash: string
  outputDir: string
  binaryName: string
  static: boolean
  strip: boolean
  timeout: number
  parallel: number
  skipTests: boolean
  skipVerification: boolean
  noCache?: boolean
}

export interface CLIOptions {
  target?: string[]
  os?: string[]
  arch?: string[]
  all?: boolean
  version?: string
  buildVersion?: string
  ldflags?: string
  tags?: string
  cgo?: boolean
  race?: boolean
  compress?: boolean
  checksum?: boolean
  clean?: boolean
  debug?: boolean
  verbose?: boolean
  silent?: boolean
  output?: string
  name?: string
  static?: boolean
  strip?: boolean
  timeout?: string
  parallel?: string
  skipTests?: boolean
  skipVerification?: boolean
  listPlatforms?: boolean
  noCache?: boolean
}

export interface ProgressData {
  current: number
  total: number
  platform: string
  status: 'building' | 'checksum' | 'signing' | 'completed' | 'error'
  binary?: string
}

export interface BuildResult {
  success: boolean
  binaries: string[]
  checksums: string[]
  failed: string[]
  duration: number
}

export interface CacheMetrics {
  cacheHits: number
  cacheMisses: number
  totalTargets: number
  timeSaved: number
}

export interface BuildMetrics {
  timestamp: number
  duration: number
  targets: number
  success: boolean
  cacheEfficiency?: number
  platform: string
}

// Packaging types
export interface ArchiveOptions {
  format: 'zip' | 'tar.gz' | 'tar.xz' | 'tar.bz2' | 'dmg';
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
}
