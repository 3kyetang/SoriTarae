import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const generatedSecretsFile = resolve("dist", "server", ".dev.vars");

await rm(generatedSecretsFile, { force: true });
console.log("Removed generated local secrets from the deployment output.");
