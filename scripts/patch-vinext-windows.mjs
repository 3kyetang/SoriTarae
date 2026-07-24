import { readFile, writeFile } from "node:fs/promises";

if (process.platform === "win32") {
  const cacheModule = new URL(
    "../node_modules/vinext/dist/server/static-file-cache.js",
    import.meta.url,
  );
  const original =
    'relativePath: path.relative(base, batch[j]),';
  const normalized =
    'relativePath: path.relative(base, batch[j]).split(path.sep).join("/"),';

  try {
    const source = await readFile(cacheModule, "utf8");
    if (!source.includes(normalized) && source.includes(original)) {
      await writeFile(cacheModule, source.replace(original, normalized), "utf8");
      console.log("Applied the vinext Windows static-asset path fix.");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
