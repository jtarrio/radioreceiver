import * as fs from 'fs/promises';
import * as path from 'path';
import * as esbuild from 'esbuild';
import { glob } from 'glob';
import esbuildPluginTsc from 'esbuild-plugin-tsc';
import { program } from 'commander';
import buildFiles from './build_settings.mjs';

program.option('--clean', 'Clean output directory');
program.option('--dist', 'Enable distribution mode');
program.option('--no-source-maps', 'Disable source maps');
program.parse();

const CLEAN_MODE = program.opts().clean;
const DIST_MODE = program.opts().dist;
const SOURCE_MAPS = program.opts().sourceMaps && !DIST_MODE;

async function distPath(name) {
    let out = path.join('dist', name);
    await fs.mkdir(path.dirname(out), { recursive: true });
    return out;
}

async function copy(src) {
    let dst = await distPath(src);
    console.log(` Copy ${src} -> ${dst}`);
    await fs.copyFile(src, dst);
}

async function compile(src) {
    let lastDot = src.lastIndexOf('.');
    let dst = await distPath(lastDot >= 0 ? src.substring(0, lastDot) + '.js' : src + '.js');
    console.log(`Build ${src} -> ${dst}`);
    return esbuild.build({
        entryPoints: [src],
        outfile: dst,
        bundle: true,
        minify: true,
        treeShaking: true,
        sourcemap: SOURCE_MAPS,
        plugins: [esbuildPluginTsc({ force: true })]
    });
}

async function build(src) {
    if ('string' !== typeof src) {
        let allNames = await Promise.allSettled(src.map(p => glob(p)));
        let allBuilds = allNames
            .filter(p => p.status == "fulfilled")
            .flatMap(p => p.value)
            .map(build);
        return await Promise.allSettled(allBuilds);
    } else if (src.endsWith('.ts') || src.endsWith('.mts') || src.endsWith('.js') || src.endsWith('.mjs')) {
        return await compile(src);
    } else {
        return await copy(src);
    }
}

let actions = {
    clean: DIST_MODE || CLEAN_MODE,
    build: !CLEAN_MODE
};

if (actions.clean) {
    await fs.rm('dist', {
        force: true,
        recursive: true,
    });
}

if (actions.build) build(buildFiles);
