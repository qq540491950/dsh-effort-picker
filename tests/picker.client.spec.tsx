import { createElement as h } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CodexEffortPicker } from '../src/client/picker';
import type { ModelSelection } from '../src/client/model';
import type { ModelDirectory } from '../src/client/services';
import { createModelDirectory, snapshot, type FakeModelDirectory } from './fixtures';

// The picker only needs @floating-ui/dom for real viewport placement; jsdom has no layout,
// so position math is covered by the existing pure estimatePanelPosition assertions.
vi.mock('@floating-ui/dom', () => ({
	computePosition: async () => ({ x: 0, y: 0 }),
	autoUpdate: () => () => {},
	offset: () => ({}),
	flip: () => ({}),
	shift: () => ({}),
}));

type User = ReturnType<typeof userEvent.setup>;

function seat(directory: FakeModelDirectory, locked = false) {
	return { locked, resolve: () => ({ available: true, directory: directory as unknown as ModelDirectory }) };
}

async function open(user: User) {
	const trigger = screen.getByRole('button', { name: /^选择模型/ });
	await user.click(trigger);
	return trigger;
}

describe('CodexEffortPicker interaction', () => {
	it('鼠标打开后焦点在触发器，Esc 关闭并把焦点还给它', async () => {
		const user = userEvent.setup();
		const directory = createModelDirectory();
		render(<CodexEffortPicker {...seat(directory)} />);
		const trigger = await open(user);

		expect(trigger).toHaveFocus();
		expect(screen.getByRole('dialog', { name: '模型与推理等级' })).toBeInTheDocument();

		await user.keyboard('{Escape}');
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(trigger).toHaveFocus();
	});

	it('Tab 在触发器与面板控件之间循环', async () => {
		const user = userEvent.setup();
		const directory = createModelDirectory();
		render(<CodexEffortPicker {...seat(directory)} />);
		const trigger = await open(user);
		const modelButton = screen.getByRole('button', { name: /选择模型，当前/ });
		const slider = screen.getByRole('slider', { name: '推理等级' });

		await user.tab();
		expect(modelButton).toHaveFocus();
		await user.tab();
		expect(slider).toHaveFocus();
		await user.tab();
		expect(trigger).toHaveFocus();
	});

	it('Shift+Tab 从模型列表退回根面板，再按一次关闭', async () => {
		const user = userEvent.setup();
		const directory = createModelDirectory();
		render(<CodexEffortPicker {...seat(directory)} />);
		const trigger = await open(user);
		await user.tab();
		const modelButton = screen.getByRole('button', { name: /选择模型，当前/ });

		await user.keyboard('{Enter}');
		const currentRow = await screen.findByRole('menuitemradio', { name: /GLM 5.3 Flash/ });
		expect(currentRow).toHaveFocus();

		await user.keyboard('{Shift>}{Tab}{/Shift}');
		expect(screen.getByRole('dialog')).toBeInTheDocument();
		expect(modelButton).toHaveFocus();

		await user.keyboard('{Shift>}{Tab}{/Shift}');
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(trigger).toHaveFocus();
	});

	it('模型列表用上下键移动，Enter 提交所选模型', async () => {
		const user = userEvent.setup();
		const directory = createModelDirectory();
		render(<CodexEffortPicker {...seat(directory)} />);
		await open(user);
		await user.tab();

		await user.keyboard('{Enter}');
		const currentRow = await screen.findByRole('menuitemradio', { name: /GLM 5.3 Flash/ });
		expect(currentRow).toHaveFocus();

		await user.keyboard('{ArrowDown}');
		const otherRow = screen.getByRole('menuitemradio', { name: /Other Model/ });
		expect(otherRow).toHaveFocus();

		await user.keyboard('{Enter}');
		await waitFor(() => {
			expect(directory.select).toHaveBeenCalledWith({
				provider: 'cpa',
				model: 'cn:other',
				reasoningEffort: 'max',
			});
		});
		expect(screen.getByRole('button', { name: /选择模型，当前/ })).toHaveFocus();
	});

	it('模型超过 4 个时显示搜索，筛完后回车提交', async () => {
		const user = userEvent.setup();
		const directory = createModelDirectory(snapshot({
			current: { provider: 'many', model: 'm-1' },
			groups: [{
				id: 'many',
				name: 'Many',
				models: Array.from({ length: 5 }, (_, index) => ({
					id: `m-${String(index + 1)}`,
					name: `Model ${String(index + 1)}`,
				})),
			}],
		}));
		render(<CodexEffortPicker {...seat(directory)} />);
		await open(user);
		await user.tab();
		await user.keyboard('{Enter}');

		const search = screen.getByRole('searchbox', { name: '搜索模型' });
		expect(search).toHaveFocus();
		await user.type(search, 'Model 5');
		expect(screen.queryByRole('menuitemradio', { name: /Model 1/ })).not.toBeInTheDocument();
		const filtered = screen.getByRole('menuitemradio', { name: /Model 5/ });
		await user.keyboard('{ArrowDown}');
		expect(filtered).toHaveFocus();
		await user.keyboard('{Enter}');
		await waitFor(() => {
			expect(directory.select).toHaveBeenCalledWith({ provider: 'many', model: 'm-5' });
		});
	});

	it('焦点移出面板会关闭', async () => {
		const user = userEvent.setup();
		const directory = createModelDirectory();
		render(<CodexEffortPicker {...seat(directory)} />);
		await open(user);

		const outside = document.createElement('button');
		outside.textContent = 'outside';
		document.body.appendChild(outside);
		outside.focus();

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		outside.remove();
	});

	it('pending 时行与滑杆禁用，焦点留在触发器', async () => {
		const user = userEvent.setup();
		const directory = createModelDirectory();
		let release: ((value: { ok: true }) => void) | undefined;
		const gate = new Promise<{ ok: true }>((resolve) => {
			release = resolve;
		});
		directory.select.mockImplementation(async (selection: ModelSelection) => {
			directory.set({ ...directory.get(), pending: selection });
			const outcome = await gate;
			directory.set({ ...directory.get(), pending: null });
			return outcome;
		});

		render(<CodexEffortPicker {...seat(directory)} />);
		const trigger = await open(user);
		await user.tab();
		await user.keyboard('{Enter}');
		const row = await screen.findByRole('menuitemradio', { name: /Other Model/ });

		await user.click(row);
		expect(trigger).toHaveFocus();
		expect(row).toBeDisabled();
		expect(row.querySelector('[data-state="ongoing"]')).not.toBeNull();
		expect(screen.getByRole('slider', { name: '推理等级' })).toHaveAttribute('tabindex', '-1');

		release?.({ ok: true });
		await waitFor(() => {
			expect(screen.getByRole('slider', { name: '推理等级' })).toHaveAttribute('tabindex', '0');
		});
	});

	it('滑杆拖拽只提交一次；pointercancel 与右键不提交', async () => {
		const user = userEvent.setup();
		const directory = createModelDirectory();
		render(<CodexEffortPicker {...seat(directory)} />);
		await open(user);
		const track = screen.getByRole('slider', { name: '推理等级' });
		vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
			left: 0,
			top: 0,
			right: 200,
			bottom: 22,
			width: 200,
			height: 22,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect);

		fireEvent.pointerDown(track, { clientX: 100, pointerId: 1, button: 0, isPrimary: true });
		expect(directory.select).not.toHaveBeenCalled();
		fireEvent.pointerMove(track, { clientX: 190, pointerId: 1, buttons: 1 });
		fireEvent.pointerUp(track, { clientX: 190, pointerId: 1 });
		await waitFor(() => expect(directory.select).toHaveBeenCalledTimes(1));
		expect(directory.select).toHaveBeenLastCalledWith({
			provider: 'cpa',
			model: 'cn:glm-5.3-flash',
			reasoningEffort: 'max',
		});

		directory.select.mockClear();
		fireEvent.pointerDown(track, { clientX: 0, pointerId: 2, button: 0, isPrimary: true });
		fireEvent.pointerCancel(track, { pointerId: 2 });
		expect(directory.select).not.toHaveBeenCalled();

		fireEvent.pointerDown(track, { clientX: 190, pointerId: 3, button: 2, isPrimary: true });
		fireEvent.pointerUp(track, { clientX: 190, pointerId: 3, button: 2 });
		expect(directory.select).not.toHaveBeenCalled();
	});

	it('空目录与 provider 失败都有可读状态', async () => {
		const user = userEvent.setup();
		const failed = createModelDirectory(snapshot({
			groups: [],
			failures: [{ id: 'bad', name: 'Broken Provider', message: 'catalog offline' }],
		}));
		const first = render(<CodexEffortPicker {...seat(failed)} />);
		await open(user);
		await user.tab();
		await user.keyboard('{Enter}');
		expect(await screen.findByText('catalog offline')).toBeInTheDocument();
		expect(screen.getByText('Broken Provider')).toBeInTheDocument();
		first.unmount();

		const empty = createModelDirectory(snapshot({ groups: [], current: null, failures: [] }));
		render(<CodexEffortPicker {...seat(empty)} />);
		await open(user);
		await user.tab();
		await user.keyboard('{Enter}');
		expect(await screen.findByText('暂无可用模型')).toBeInTheDocument();
	});

	it('点击面板外关闭，点击面板内不关闭', async () => {
		const user = userEvent.setup();
		const directory = createModelDirectory();
		render(<CodexEffortPicker {...seat(directory)} />);
		await open(user);

		fireEvent.mouseDown(screen.getByRole('dialog'));
		expect(screen.getByRole('dialog')).toBeInTheDocument();

		fireEvent.mouseDown(document.body);
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});
});
