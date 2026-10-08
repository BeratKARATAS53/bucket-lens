import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import prettier from 'eslint-config-prettier';

const compat = new FlatCompat({
	baseDirectory: path.dirname(fileURLToPath(import.meta.url)),
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
});

export default [
	{ ignores: ['dist/**', 'node_modules/**', 'server/**'] },
	...compat.extends('./.eslintrc.json'),
	prettier,
];
