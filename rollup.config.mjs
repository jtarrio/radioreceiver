import typescript from '@rollup/plugin-typescript';

export default [
    {
        input: 'tools/basic_receiver.ts',
        output: {
            file: 'dist/tools/basic_receiver.js',
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
]
