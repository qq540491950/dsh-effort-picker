import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
	oxc: {
		jsx: {
			runtime: 'classic',
			pragma: 'h',
			pragmaFrag: 'Fragment',
		},
	},
	resolve: {
		alias: {
			'@deepseek-ai/dsh-client-ui-primitives': here('./tests/mocks/primitives.tsx'),
		},
	},
	test: {
		environment: 'jsdom',
		setupFiles: [here('./tests/setup.ts')],
		include: ['tests/**/*.spec.tsx'],
		restoreMocks: true,
	},
});
