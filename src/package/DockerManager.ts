import { execa } from "execa";
import fs from "fs-extra";
import path from "path";

import { Logger } from "../core/Logger.js";
export interface DockerOptions {
  name: string;
  version: string;
  port?: number;
  baseImage?: string;
  maintainer?: string;
  labels?: Record<string, string>;
  multiStage?: boolean;
}
export class DockerManager {
  static async buildImage(
    binaryPath: string,
    outputDir: string,
    options: DockerOptions,
  ): Promise<string> {
    const imageName = `${options.name.toLowerCase()}:${options.version}`;
    const dockerfilePath = path.join(outputDir, "Dockerfile");
    const dockerfile = this.generateDockerfile(binaryPath, options);
    await fs.writeFile(dockerfilePath, await dockerfile);
    try {
      await execa(
        "docker",
        ["build", "-t", imageName, "-f", dockerfilePath, "."],
        {
          stdio: "inherit",
        },
      );
      Logger.success(`Docker image built: ${imageName}`);
      return imageName;
    } catch (error) {
      throw new Error(`Docker build failed: ${error}`);
    }
  }
  static async pushImage(
    imageName: string,
    registry?: string,
    tag?: string,
  ): Promise<void> {
    const fullImageName = registry ? `${registry}/${imageName}` : imageName;
    const targetTag = tag || "latest";
    try {
      await execa("docker", [
        "tag",
        imageName,
        `${fullImageName}:${targetTag}`,
      ]);
      await execa("docker", ["push", `${fullImageName}:${targetTag}`], {
        stdio: "inherit",
      });
      Logger.success(`Docker image pushed: ${fullImageName}:${targetTag}`);
    } catch (error) {
      throw new Error(`Docker push failed: ${error}`);
    }
  }
  static async generateDockerfile(
    binaryPath: string,
    options: DockerOptions,
  ): Promise<string> {
    const binaryName = path.basename(binaryPath);
    const baseImage = options.baseImage || "alpine:latest";
    const port = options.port || 8080;
    if (options.multiStage) {
      return this.generateMultiStageDockerfile(binaryName, options);
    }
    return `FROM ${baseImage}
# Install CA certificates for HTTPS
RUN apk add --no-cache ca-certificates && \\
    update-ca-certificates
# Create non-root user
RUN addgroup -S app && adduser -S app -G app
# Copy binary
COPY ${binaryName} /usr/local/bin/${binaryName}
RUN chmod +x /usr/local/bin/${binaryName}
# Switch to non-root user
USER app
# Expose port
EXPOSE ${port}
# Set entrypoint
ENTRYPOINT ["/usr/local/bin/${binaryName}"]
`;
  }
  private static generateMultiStageDockerfile(
    binaryName: string,
    options: DockerOptions,
  ): string {
    return `# Build stage
FROM golang:1.19-alpine AS builder
WORKDIR /app
COPY . .
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o ${binaryName} .
# Final stage
FROM alpine:latest
RUN apk add --no-cache ca-certificates
RUN addgroup -S app && adduser -S app -G app
WORKDIR /root/
COPY --from=builder /app/${binaryName} .
RUN chown app:app ${binaryName}
USER app
EXPOSE ${options.port || 8080}
CMD ["./${binaryName}"]
`;
  }
  static async saveImage(
    imageName: string,
    outputDir: string,
  ): Promise<string> {
    const tarName = `${imageName.replace(/[/:]/g, "_")}.tar`;
    const tarPath = path.join(outputDir, tarName);
    await fs.ensureDir(outputDir);
    try {
      await execa("docker", ["save", "-o", tarPath, imageName]);
      Logger.success(`Docker image saved: ${tarPath}`);
      return tarPath;
    } catch (error) {
      throw new Error(`Docker save failed: ${error}`);
    }
  }
}
