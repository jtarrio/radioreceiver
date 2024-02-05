import * as fs from 'fs/promises';
import * as path from 'path';
import * as esbuild from 'esbuild';
import { glob } from 'glob';
import esbuildPluginTsc from 'esbuild-plugin-tsc';

async function needsUpdate(src, dst) {
    try {
        let [srcStat, dstStat] = await Promise.all([fs.stat(src), fs.stat(dst)]);
        return srcStat.mtime > dstStat.mtime;
    } catch {
        return true;
    }
}

async function distPath(name) {
    let out = path.join('dist', name);
    await fs.mkdir(path.dirname(out), { recursive: true });
    return out;
}

async function forPattern(pattern, fn) {
    let names = await glob(pattern);
    await Promise.all(names.map(fn));
}

async function copy(src) {
    let dst = await distPath(src);
    if (!await needsUpdate(src, dst)) return;
    console.log(` Copy ${src} -> ${dst}`);
    await fs.copyFile(src, dst);
}

async function build(src) {
    let lastDot = src.lastIndexOf('.');
    let dst = await distPath(lastDot >= 0 ? src.substring(0, lastDot) + '.js' : src + '.js');
    if (!await needsUpdate(src, dst)) return;
    console.log(`Build ${src} -> ${dst}`);
    return esbuild.build({
        entryPoints: [src],
        bundle: true,
        outfile: dst,
        plugins: [esbuildPluginTsc({ force: true })]
    });
}

await Promise.allSettled([
    forPattern('tools/*.html', copy),
    forPattern('tools/*.ts', build),
]);
