import * as fs from "fs/promises";
import * as path from "path";
import * as esbuild from "esbuild";
import { glob } from "glob";
import esbuildPluginTsc from "esbuild-plugin-tsc";
import { program } from "commander";
import buildCommands from "./build_settings.mjs";

program.option("--clean", "Clean output directory");
program.option("--dist", "Enable distribution mode");
program.option("--no-source-maps", "Disable source maps");
program.option("--no-minify", "Disable minification");
program.parse();

const CLEAN_MODE = program.opts().clean;
const DIST_MODE = program.opts().dist;
const SOURCE_MAPS = program.opts().sourceMaps && !DIST_MODE;
const MINIFY = program.opts().minify;

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
    minify: MINIFY,
    treeShaking: true,
    sourcemap: SOURCE_MAPS,
    loader: {
      ".html": "copy",
      ".png": "copy",
      ".ttf": "file",
      ".woff": "file",
      ".woff2": "file",
    },
    plugins: [esbuildPluginTsc({ force: true })],
  });
}

async function copyDir(src, dest) {
  console.log(`Copy ${src} to ${dest}`);
  return fs.cp(src, dest, { recursive: true });
}

async function copy(src, base, dest) {
  let srcFiles = await glob(src, { nodir: true });
  if (srcFiles.length == 0) {
    console.log(`Warning: no files matched for ${src.join(", ")}`);
    return;
  }
  for (let src of srcFiles) {
    let relative = path.relative(base, src);
    let target = path.resolve(dest, relative);
    console.log(`Copying ${src} to ${target}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(src, target);
  }
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
  } else if (cmd.copyDir !== undefined) {
    let srcs = asArray(cmd.copyDir);
    let dests = asArray(cmd.to);
    await Promise.allSettled(
      srcs.flatMap((src) => dests.map((dest) => copyDir(src, dest)))
    );
  } else if (cmd.copy !== undefined) {
    let srcs = asArray(cmd.copy);
    let base = cmd.base;
    let dests = asArray(cmd.to);
    await Promise.allSettled(dests.map((dest) => copy(srcs, base, dest)));
  } else {
    throw `Unknown command: ${JSON.stringify(cmd)}`;
  }
}

async function main() {
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
}

main();
