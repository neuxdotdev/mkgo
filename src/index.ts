#!/usr/bin/env node
import { CLI } from "./cli.js";
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Rejection:", reason);
  process.exit(1);
});
async function main() {
  const cli = new CLI();
  cli.parse(process.argv);
}
main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
