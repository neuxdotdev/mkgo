#!/bin/bash
set -e
PROJECT_NAME="${PROJECT_NAME:-$(basename "$(pwd)")}"
MAIN_PACKAGE="${MAIN_PACKAGE:-./cmd/${PROJECT_NAME}}"
BUILD_DIR="${BUILD_DIR:-build}"
VERSION="${VERSION:-1.0.0}"
BUILD_TIME=$(date -u '+%Y-%m-%d_%H:%M:%S_UTC')
TIMESTAMP=$(date +%Y%m%d)
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
GO_VERSION=$(go version | awk '{print $3}')
BUILD_PROFILE="${BUILD_PROFILE:-release}" # release|debug|dev
LDFLAGS=""
SUPPORTED_PLATFORMS=(
  "linux/amd64" "linux/arm64" "linux/386" "linux/ppc64le" "linux/s390x"
  "linux/riscv64" "linux/mips64le" "linux/mips64"
  "darwin/amd64" "darwin/arm64"
  "windows/amd64" "windows/arm64" "windows/386"
  "freebsd/amd64" "freebsd/arm64" "freebsd/386"
  "netbsd/amd64" "netbsd/arm64"
  "openbsd/amd64" "openbsd/arm64"
  "dragonfly/amd64"
  "solaris/amd64"
  "aix/ppc64"
  "android/arm64"
  "illumos/amd64"
)
DEBUG=false
VERBOSE=false
RUN_TESTS=false
RUN_LINT=false
RUN_VET=false
RUN_SECURITY_SCAN=false
CREATE_ARCHIVES=false
CLEAN_BUILD=false
DOCKER_BUILD=false
PARALLEL_BUILD=true
MAX_JOBS=$(nproc)
COLOR_OUTPUT=true
TARGET_PLATFORMS=()
BUILD_HOOKS_ENABLED=true
if [ "$COLOR_OUTPUT" = true ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    MAGENTA='\033[0;35m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; BLUE=''; MAGENTA=''; CYAN=''; BOLD=''; NC=''
fi
show_banner() {
    cat << EOF
${BOLD}${GREEN}
╔══════════════════════════════════════════════════════════════════════════════╗
║                     UNIVERSAL GO BUILD FRAMEWORK                            ║
║                        Enterprise Edition v2.0                             ║
╚══════════════════════════════════════════════════════════════════════════════╝
${NC}
${BOLD}Project:${NC} ${PROJECT_NAME} ${BOLD}Version:${NC} ${VERSION} ${BOLD}Profile:${NC} ${BUILD_PROFILE}
${BOLD}Time:${NC} ${BUILD_TIME} ${BOLD}Git:${NC} ${GIT_BRANCH}@${GIT_HASH}
EOF
}
show_help() {
    show_banner
    cat << EOF
${BOLD}Usage:${NC} $0 [OPTIONS]
${BOLD}Core Options:${NC}
    -h, --help           Show this help message
    -v, --verbose        Enable verbose output
    --debug              Enable debug mode (adds debug symbols)
    --profile PROFILE    Set build profile: release, debug, dev (default: release)
    --target OS/ARCH     Build for specific target (e.g. linux/amd64)
    --all                Build for all supported platforms
    --version VERSION    Set version (default: ${VERSION})
${BOLD}Quality Assurance:${NC}
    --test               Run tests before building
    --lint               Run golangci-lint (if available)
    --vet                Run go vet
    --security           Run security scan (govulncheck)
    --no-parallel        Disable parallel builds
    --max-jobs N         Set maximum parallel jobs (default: ${MAX_JOBS})
${BOLD}Build Management:${NC}
    --clean              Clean build directory before building
    --archive            Create .tar.gz/.zip archives
    --docker             Build using Docker
    --no-hooks          Disable build hooks
    --no-color          Disable colored output
${BOLD}Examples:${NC}
    $0                                  # Build for current platform
    $0 --all --archive --test          # Build all platforms with tests & archives
    $0 --target linux/amd64 --verbose  # Build specific platform with verbose output
    $0 --profile debug --test --lint   # Debug build with tests and linting
    $0 --clean --docker                # Clean build using Docker
${BOLD}Supported Platforms:${NC}
    $(printf "  %s\n" "${SUPPORTED_PLATFORMS[@]}" | paste -sd, - | fold -sw 60 | sed '2,$s/^/  /')
${BOLD}Environment Variables:${NC}
    PROJECT_NAME    Set project name (default: directory name)
    MAIN_PACKAGE    Set main package path (default: ./cmd/<project>)
    BUILD_DIR       Set build directory (default: build)
    BUILD_PROFILE   Set build profile (default: release)
EOF
}
log() {
    echo -e "${GREEN}[INFO]${NC} $1" | tee -a "${BUILD_LOG}" >&2
}
log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "${BUILD_LOG}" >&2
}
log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "${BUILD_LOG}" >&2
}
log_debug() {
    if [ "$DEBUG" = true ]; then
        echo -e "${MAGENTA}[DEBUG]${NC} $1" | tee -a "${BUILD_LOG}" >&2
    fi
}
log_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${CYAN}[VERBOSE]${NC} $1" | tee -a "${BUILD_LOG}" >&2
    fi
}
log_success() {
    echo -e "${GREEN}✅${NC} $1" | tee -a "${BUILD_LOG}" >&2
}
log_failure() {
    echo -e "${RED}❌${NC} $1" | tee -a "${BUILD_LOG}" >&2
}
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                show_help
                exit 0
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            --debug)
                DEBUG=true
                BUILD_PROFILE="debug"
                shift
                ;;
            --profile)
                if [[ -n "$2" && "$2" != --* ]]; then
                    BUILD_PROFILE="$2"
                    shift 2
                else
                    log_error "--profile requires an argument (release|debug|dev)"
                    exit 1
                fi
                ;;
            --target)
                shift
                if [[ $# -eq 0 || "$1" == --* ]]; then
                    log_error "--target requires at least one platform"
                    exit 1
                fi
                while [[ $# -gt 0 && "$1" != --* ]]; do
                    TARGET_PLATFORMS+=("$1")
                    shift
                done
                ;;
            --all)
                TARGET_PLATFORMS=("${SUPPORTED_PLATFORMS[@]}")
                shift
                ;;
            --version)
                if [[ -n "$2" && "$2" != --* ]]; then
                    VERSION="$2"
                    shift 2
                else
                    log_error "--version requires an argument"
                    exit 1
                fi
                ;;
            --test)
                RUN_TESTS=true
                shift
                ;;
            --lint)
                RUN_LINT=true
                shift
                ;;
            --vet)
                RUN_VET=true
                shift
                ;;
            --security)
                RUN_SECURITY_SCAN=true
                shift
                ;;
            --clean)
                CLEAN_BUILD=true
                shift
                ;;
            --archive)
                CREATE_ARCHIVES=true
                shift
                ;;
            --docker)
                DOCKER_BUILD=true
                shift
                ;;
            --no-parallel)
                PARALLEL_BUILD=false
                shift
                ;;
            --max-jobs)
                if [[ -n "$2" && "$2" =~ ^[0-9]+$ ]]; then
                    MAX_JOBS="$2"
                    shift 2
                else
                    log_error "--max-jobs requires a number"
                    exit 1
                fi
                ;;
            --no-hooks)
                BUILD_HOOKS_ENABLED=false
                shift
                ;;
            --no-color)
                COLOR_OUTPUT=false
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}
setup_build_environment() {
    if [ "$CLEAN_BUILD" = true ] && [ -d "$BUILD_DIR" ]; then
        log "Cleaning build directory..."
        rm -rf "$BUILD_DIR"
    fi
    mkdir -p "$BUILD_DIR"
    BUILD_LOG="${BUILD_DIR}/build_${TIMESTAMP}.log"
    echo "Build started at: $(date)" > "$BUILD_LOG"
    echo "Project: $PROJECT_NAME" >> "$BUILD_LOG"
    echo "Version: $VERSION" >> "$BUILD_LOG"
    mkdir -p "${BUILD_DIR}/hooks"
}
validate_environment() {
    log "Validating build environment..."
    if ! command -v go &> /dev/null; then
        log_error "Go compiler not found. Please install Go first."
        exit 1
    fi
    if [ ! -d "$MAIN_PACKAGE" ] && [ ! -f "${MAIN_PACKAGE}/main.go" ]; then
        log_warn "Main package not found: $MAIN_PACKAGE"
        log "Trying to find main package..."
        find . -name "main.go" -type f | head -5 | while read -r main_file; do
            log "Found: $main_file"
        done
        log_error "Please set MAIN_PACKAGE environment variable or use --main-package"
        exit 1
    fi
    if [ ! -f "go.mod" ]; then
        log_error "go.mod not found. Initialize module first: go mod init <module>"
        exit 1
    fi
    log_verbose "Go version: $(go version)"
    log_verbose "Go environment: GOOS=$(go env GOOS) GOARCH=$(go env GOARCH)"
    log_verbose "Build profile: $BUILD_PROFILE"
}
setup_build_profile() {
    case "$BUILD_PROFILE" in
        release)
            LDFLAGS="-s -w -X main.Version=${VERSION} -X main.BuildTime=${BUILD_TIME} -X main.CommitHash=${GIT_HASH} -X main.GoVersion=${GO_VERSION}"
            BUILD_ARGS=(-trimpath)
            ;;
        debug)
            LDFLAGS="-X main.Version=${VERSION} -X main.BuildTime=${BUILD_TIME} -X main.CommitHash=${GIT_HASH}"
            BUILD_ARGS=(-gcflags "all=-N -l")
            DEBUG=true
            ;;
        dev)
            LDFLAGS="-X main.Version=${VERSION}-dev -X main.BuildTime=${BUILD_TIME} -X main.CommitHash=${GIT_HASH}"
            BUILD_ARGS=(-race)
            ;;
        *)
            log_error "Unknown build profile: $BUILD_PROFILE"
            exit 1
            ;;
    esac
    LDFLAGS="$LDFLAGS -X main.BuildProfile=${BUILD_PROFILE} -X main.ProjectName=${PROJECT_NAME}"
    log_verbose "LDFLAGS: $LDFLAGS"
}
run_quality_checks() {
    local failed_checks=0
    log "Running quality assurance checks..."
    log_verbose "Running go mod tidy..."
    go mod tidy
    if [ "$RUN_VET" = true ]; then
        log "Running go vet..."
        if ! go vet ./... 2>> "$BUILD_LOG"; then
            log_error "go vet failed"
            ((failed_checks++))
        else
            log_success "go vet passed"
        fi
    fi
    log_verbose "Checking code format..."
    local unformatted
    unformatted=$(go fmt ./...)
    if [ -n "$unformatted" ]; then
        log_warn "Some files need formatting. Run 'go fmt ./...'"
        echo "$unformatted" >> "$BUILD_LOG"
    fi
    if [ "$RUN_LINT" = true ]; then
        if command -v golangci-lint &> /dev/null; then
            log "Running golangci-lint..."
            if ! golangci-lint run ./... >> "$BUILD_LOG" 2>&1; then
                log_error "Linting failed - check $BUILD_LOG for details"
                ((failed_checks++))
            else
                log_success "Linting passed"
            fi
        else
            log_warn "golangci-lint not found, skipping linting"
        fi
    fi
    if [ "$RUN_SECURITY_SCAN" = true ]; then
        if command -v govulncheck &> /dev/null; then
            log "Running security scan..."
            if ! govulncheck ./... >> "$BUILD_LOG" 2>&1; then
                log_warn "Vulnerabilities found - check $BUILD_LOG for details"
            else
                log_success "No vulnerabilities found"
            fi
        else
            log_warn "govulncheck not found, skipping security scan"
        fi
    fi
    if [ "$RUN_TESTS" = true ]; then
        log "Running tests..."
        if ! go test ./... -v 2>> "$BUILD_LOG"; then
            log_error "Tests failed"
            ((failed_checks++))
        else
            log_success "All tests passed"
        fi
        log_verbose "Generating test coverage..."
        go test ./... -coverprofile="${BUILD_DIR}/coverage.out" >> "$BUILD_LOG" 2>&1
        if [ -f "${BUILD_DIR}/coverage.out" ]; then
            go tool cover -func="${BUILD_DIR}/coverage.out" > "${BUILD_DIR}/coverage.txt"
            log "Test coverage: $(tail -1 "${BUILD_DIR}/coverage.txt" | awk '{print $3}')"
        fi
    fi
    return $failed_checks
}
execute_build_hooks() {
    if [ "$BUILD_HOOKS_ENABLED" = false ]; then
        return 0
    fi
    local hook_type="$1"
    local hook_dir="./scripts/hooks/${hook_type}"
    if [ ! -d "$hook_dir" ]; then
        return 0
    fi
    log_verbose "Executing $hook_type hooks..."
    for hook in "$hook_dir"/*.sh; do
        if [ -x "$hook" ]; then
            log_verbose "Running hook: $(basename "$hook")"
            if ! "$hook" "$PROJECT_NAME" "$VERSION" "$BUILD_PROFILE"; then
                log_error "Hook failed: $(basename "$hook")"
                return 1
            fi
        fi
    done
    return 0
}
generate_binary_name() {
    local os="$1"
    local arch="$2"
    local random_hash=$(head -c 100 /dev/urandom | sha256sum | head -c 8)
    local binary_name="${PROJECT_NAME}-${VERSION}-${os}-${arch}-${random_hash}"
    if [ "$os" = "windows" ]; then
        binary_name="${binary_name}.exe"
    fi
    echo "$binary_name"
}
build_for_platform() {
    local os="$1"
    local arch="$2"
    local binary_name=$(generate_binary_name "$os" "$arch")
    local output_path="${BUILD_DIR}/${binary_name}"
    log "Building for ${BOLD}${os}/${arch}${NC} -> ${binary_name}"
    local build_cmd=(go build -ldflags "$LDFLAGS" "${BUILD_ARGS[@]}" -o "$output_path" "$MAIN_PACKAGE")
    log_verbose "Build command: GOOS=${os} GOARCH=${arch} ${build_cmd[*]}"
    if env GOOS="$os" GOARCH="$arch" "${build_cmd[@]}" 2>> "$BUILD_LOG"; then
        if [ "$os" != "windows" ]; then
            chmod +x "$output_path"
        fi
        if [ "$CREATE_ARCHIVES" = true ]; then
            create_archive "$output_path" "$os"
        fi
        log_success "Build successful: ${binary_name}"
        echo "$output_path"
        return 0
    else
        log_failure "Build failed for ${os}/${arch}"
        return 1
    fi
}
create_archive() {
    local binary_path="$1"
    local os="$2"
    local binary_name=$(basename "$binary_path")
    local archive_name="${binary_path%.*}"
    case "$os" in
        windows)
            archive_name="${archive_name}.zip"
            if command -v zip &> /dev/null; then
                zip -j "$archive_name" "$binary_path" > /dev/null 2>> "$BUILD_LOG"
            fi
            ;;
        *)
            archive_name="${archive_name}.tar.gz"
            if command -v tar &> /dev/null; then
                tar -czf "$archive_name" -C "$(dirname "$binary_path")" "$binary_name" > /dev/null 2>> "$BUILD_LOG"
            fi
            ;;
    esac
    if [ -f "$archive_name" ]; then
        log_verbose "Created archive: $(basename "$archive_name")"
    fi
}
build_platform_parallel() {
    local platform="$1"
    local os="${platform%%/*}"
    local arch="${platform##*/}"
    if build_for_platform "$os" "$arch"; then
        echo "SUCCESS:$platform:$output_path" >> "${BUILD_DIR}/build_results.txt"
    else
        echo "FAILED:$platform" >> "${BUILD_DIR}/build_results.txt"
    fi
}
generate_checksums() {
    log "Generating checksums..."
    local checksum_file="${BUILD_DIR}/checksums.txt"
    local individual_checksum_dir="${BUILD_DIR}/checksums"
    mkdir -p "$individual_checksum_dir"
    find "$BUILD_DIR" -maxdepth 1 -type f \( -name "${PROJECT_NAME}-*" - ! -name "*.txt" - ! -name "*.log" - ! -name "*.json" \) | while read -r file; do
        if [ -f "$file" ]; then
            local checksum
            checksum=$(sha256sum "$file" | awk '{print $1}')
            local filename=$(basename "$file")
            echo "$checksum" > "${individual_checksum_dir}/${filename}.sha256"
            echo "${checksum}  ${filename}" >> "$checksum_file"
            log_verbose "Checksum: $filename → $checksum"
        fi
    done
    log_success "Checksums generated"
}
generate_build_metadata() {
    log "Generating build metadata..."
    local metadata_file="${BUILD_DIR}/build_metadata.json"
    local binary_count=$(find "$BUILD_DIR" -type f -name "${PROJECT_NAME}-*" - ! -name "*.txt" - ! -name "*.log" - ! -name "*.json" | wc -l)
    cat > "$metadata_file" << EOF
{
  "project": "$PROJECT_NAME",
  "version": "$VERSION",
  "build_time": "$BUILD_TIME",
  "build_profile": "$BUILD_PROFILE",
  "git": {
    "commit": "$GIT_HASH",
    "branch": "$GIT_BRANCH"
  },
  "go_version": "$GO_VERSION",
  "build_system": {
    "platforms_built": ${#TARGET_PLATFORMS[@]},
    "binaries_generated": $binary_count,
    "tests_run": $RUN_TESTS,
    "linting_run": $RUN_LINT,
    "security_scan_run": $RUN_SECURITY_SCAN
  },
  "environment": {
    "goos": "$(go env GOOS)",
    "goarch": "$(go env GOARCH)",
    "parallel_build": $PARALLEL_BUILD,
    "max_jobs": $MAX_JOBS
  }
}
EOF
    log_verbose "Build metadata saved to: $(basename "$metadata_file")"
}
build_summary() {
    local success_count=0
    local fail_count=0
    if [ -f "${BUILD_DIR}/build_results.txt" ]; then
        success_count=$(grep -c "SUCCESS:" "${BUILD_DIR}/build_results.txt" || true)
        fail_count=$(grep -c "FAILED:" "${BUILD_DIR}/build_results.txt" || true)
    fi
    local total_binaries=$(find "$BUILD_DIR" -type f -name "${PROJECT_NAME}-*" - ! -name "*.txt" - ! -name "*.log" - ! -name "*.json" | wc -l)
    log "================================================================================"
    log_success "BUILD COMPLETED SUCCESSFULLY"
    log "================================================================================"
    cat << EOF | tee -a "$BUILD_LOG"
${BOLD}Build Summary:${NC}
  Project:     ${PROJECT_NAME} ${VERSION}
  Profile:     ${BUILD_PROFILE}
  Time:        ${BUILD_TIME}
  Duration:    ${SECONDS} seconds
${BOLD}Results:${NC}
  Platforms:   ${success_count} successful, ${fail_count} failed
  Binaries:    ${total_binaries} generated
  Location:    ${BUILD_DIR}/
${BOLD}Artifacts:${NC}
  Binaries:    ${BUILD_DIR}/${PROJECT_NAME}-*
  Checksums:   ${BUILD_DIR}/checksums.txt
  Metadata:    ${BUILD_DIR}/build_metadata.json
  Log:         ${BUILD_LOG}
${BOLD}Next Steps:${NC}
  Use '${BUILD_DIR}/${PROJECT_NAME}-*' for deployment
  Verify with 'sha256sum -c ${BUILD_DIR}/checksums.txt'
EOF
    if [ $fail_count -gt 0 ]; then
        log_warn "Some platforms failed to build:"
        grep "FAILED:" "${BUILD_DIR}/build_results.txt" | cut -d: -f2 | while read -r platform; do
            log "  - $platform"
        done
    fi
}
main() {
    local start_time=$(date +%s)
    parse_arguments "$@"
    show_banner
    setup_build_environment
    validate_environment
    setup_build_profile
    if ! execute_build_hooks "pre-build"; then
        log_error "Pre-build hooks failed"
        exit 1
    fi
    if ! run_quality_checks; then
        log_error "Quality checks failed - aborting build"
        exit 1
    fi
    if [ ${#TARGET_PLATFORMS[@]} -eq 0 ]; then
        TARGET_PLATFORMS=("$(go env GOOS)/$(go env GOARCH)")
        log "No target specified, building for current platform: ${TARGET_PLATFORMS[0]}"
    else
        log "Building for ${#TARGET_PLATFORMS[@]} platform(s)"
    fi
    local built_binaries=()
    local failed_builds=()
    if [ "$PARALLEL_BUILD" = true ] && [ ${#TARGET_PLATFORMS[@]} -gt 1 ]; then
        log "Building ${#TARGET_PLATFORMS[@]} platforms in parallel (max jobs: $MAX_JOBS)"
        printf "%s\n" "${TARGET_PLATFORMS[@]}" | xargs -I {} -P "$MAX_JOBS" bash -c "
            '$0' --single-build {} \
            --version '$VERSION' \
            --profile '$BUILD_PROFILE' \
            ${VERBOSE:+--verbose} \
            ${DEBUG:+--debug} \
            ${CREATE_ARCHIVES:+--archive}
        "
        if [ -f "${BUILD_DIR}/build_results.txt" ]; then
            while IFS=: read -r result platform binary_path; do
                if [ "$result" = "SUCCESS" ]; then
                    built_binaries+=("$binary_path")
                else
                    failed_builds+=("$platform")
                fi
            done < "${BUILD_DIR}/build_results.txt"
        fi
    else
        for platform in "${TARGET_PLATFORMS[@]}"; do
            local os="${platform%%/*}"
            local arch="${platform##*/}"
            if [[ " ${SUPPORTED_PLATFORMS[*]} " == *"${os}/${arch}"* ]]; then
                if build_for_platform "$os" "$arch"; then
                    built_binaries+=("$output_path")
                else
                    failed_builds+=("${os}/${arch}")
                fi
            else
                log_error "Unsupported platform: ${os}/${arch}"
                failed_builds+=("${os}/${arch}")
            fi
        done
    fi
    if [ ${#built_binaries[@]} -gt 0 ]; then
        generate_checksums
        generate_build_metadata
        execute_build_hooks "post-build"
    fi
    local end_time=$(date +%s)
    SECONDS=$((end_time - start_time))
    build_summary
    if [ ${#failed_builds[@]} -gt 0 ]; then
        log_error "Build completed with failures: ${#failed_builds[@]} platforms failed"
        exit 1
    else
        log_success "All builds completed successfully!"
        exit 0
    fi
}
if [[ "${1:-}" == "--single-build" ]]; then
    shift
    PLATFORM="$1"
    shift
    os="${PLATFORM%%/*}"
    arch="${PLATFORM##*/}"
    build_for_platform "$os" "$arch"
    exit $?
fi
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
