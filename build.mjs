import * as fs from "fs/promises";
import * as esbuild from "esbuild";
import { glob } from "glob";
import esbuildPluginTsc from "esbuild-plugin-tsc";
import { program } from "commander";
import buildCommands from "./build_settings.mjs";

program.option("--clean", "Clean output directory");
program.option("--dist", "Enable distribution mode");
program.option("--no-source-maps", "Disable source maps");
program.parse();

const CLEAN_MODE = program.opts().clean;
const DIST_MODE = program.opts().dist;
const SOURCE_MAPS = program.opts().sourceMaps && !DIST_MODE;

function asArray(src) {
  if (Array.isArray(src)) return src;
  return [src];
}

async function compile(src) {
  console.log(`Build ${src}`);
  let assetPrefix = src.substring(0, src.indexOf("/"));
  return esbuild.build({
    entryPoints: [src],
    outdir: "dist",
    outbase: ".",
    assetNames: `${assetPrefix}/assets/[name]-[hash]`,
    bundle: true,
    minify: true,
    treeShaking: true,
    sourcemap: SOURCE_MAPS,
    loader: {
      ".html": "copy",
      ".ttf": "file",
      ".woff": "file",
      ".woff2": "file",
    },
    plugins: [esbuildPluginTsc({ force: true })],
  });
}

async function copy(src, dest) {
  console.log(`Copy ${src} to ${dest}`);
  return fs.cp(src, dest, { recursive: true });
}

async function run(cmd) {
  if (Array.isArray(cmd)) {
    for (let c of cmd) {
      await run(c);
    }
  } else if (cmd.compile !== undefined) {
    let src = asArray(cmd.compile);
    let allNames = await Promise.allSettled(
      src.map((p) => glob(p, { nodir: true }))
    );
    let allBuilds = allNames
      .filter((p) => p.status == "fulfilled")
      .flatMap((p) => p.value)
      .map(compile);
    await Promise.allSettled(allBuilds);
  } else if (cmd.copy !== undefined) {
    let srcs = asArray(cmd.copy);
    let dests = asArray(cmd.to);
    await Promise.allSettled(
      srcs.flatMap((src) => dests.map((dest) => copy(src, dest)))
    );
  } else {
    throw `Unknown command: ${JSON.stringify(cmd)}`;
  }
}

let actions = {
  clean: DIST_MODE || CLEAN_MODE,
  build: !CLEAN_MODE,
};

if (actions.clean) {
  await fs.rm("dist", {
    force: true,
    recursive: true,
  });
}

if (actions.build) run(buildCommands);
