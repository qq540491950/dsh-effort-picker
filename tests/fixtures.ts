import { vi } from 'vitest';
import type { DirectorySnapshot, ModelSelection } from '../src/client/model';

export interface FakeModelDirectory {
	store: {
		subscribe(listener: () => void): () => void;
		getSnapshot(): DirectorySnapshot;
	};
	load: ReturnType<typeof vi.fn>;
	select: ReturnType<typeof vi.fn>;
	get(): DirectorySnapshot;
	set(next: DirectorySnapshot): void;
}

export function snapshot(overrides: Partial<DirectorySnapshot> = {}): DirectorySnapshot {
	return {
		status: 'ready',
		current: { provider: 'cpa', model: 'cn:glm-5.3-flash', reasoningEffort: 'medium' },
		groups: [
			{
				id: 'cpa',
				name: 'CPA',
				models: [
					{
						id: 'cn:glm-5.3-flash',
						name: 'GLM 5.3 Flash',
						reasoning: {
							efforts: [
								{ id: 'off', name: 'Off' },
								{ id: 'low', name: 'Low' },
								{ id: 'medium', name: 'Medium' },
								{ id: 'high', name: 'High' },
								{ id: 'max', name: 'Max' },
							],
							defaultEffort: 'medium',
						},
					},
					{
						id: 'cn:other',
						name: 'Other Model',
						reasoning: {
							efforts: [
								{ id: 'low', name: 'Low' },
								{ id: 'max', name: 'Max' },
							],
							defaultEffort: 'low',
						},
					},
				],
			},
			{
				id: 'huawei',
				name: 'Huawei',
				models: [{ id: 'hw-1', name: 'HW One' }],
			},
		],
		pending: null,
		error: null,
		failures: [],
		...overrides,
	};
}

export function createModelDirectory(initial: DirectorySnapshot = snapshot()): FakeModelDirectory {
	let state = initial;
	const listeners = new Set<() => void>();
	const emit = (): void => {
		for (const listener of listeners) listener();
	};
	const directory: FakeModelDirectory = {
		store: {
			subscribe(listener) {
				listeners.add(listener);
				return () => {
					listeners.delete(listener);
				};
			},
			getSnapshot: () => state,
		},
		load: vi.fn(async () => state),
		select: vi.fn(async (selection: ModelSelection) => {
			state = { ...state, pending: selection };
			emit();
			state = { ...state, pending: null, current: selection };
			emit();
			return { ok: true as const };
		}),
		get: () => state,
		set(next) {
			state = next;
			emit();
		},
	};
	return directory;
}
