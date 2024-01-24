import typescript from '@rollup/plugin-typescript';

function compileTsFile(name) {
    let lastDot = name.lastIndexOf('.');
    let outName = lastDot >= 0 ? name.substring(0, lastDot) + '.js' : name + '.js';
    return {
        input: name,
        output: {
            file: `dist/${outName}`,
            format: 'iife',
        },
        plugins: [
            typescript({
                compilerOptions: {
                    target: 'esnext',
                }
            })
        ],
    }
}

export default [
    compileTsFile('tools/basic_receiver.ts'),
    compileTsFile('tools/filter_explorer.ts'),
]
