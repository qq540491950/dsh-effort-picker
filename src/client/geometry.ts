/**
 * 滑杆的几何换算（纯函数，没有 React、没有 DOM，因此可以离线断言）。
 *
 * 这里有一条必须守住的不变量：**进度填充的宽度与滑块的 left 必须同源**——两者都用
 * {@link centerAt}。填充的右端永远被滑块盖住，一旦各自算各自的，接缝就会露出来
 * （`tools/verify.mjs` 第 8b 组盯着这条）。
 */

/**
 * 滑块直径。比轨道（`styles.track.height` 的 22px）略大是刻意的：白色圆钮本来就该
 * 略微探出轨道上下边缘（约 1.13:1，与参考图一致）。
 */
export const THUMB_SIZE = 25;

/** 滑块半径：轨道两端的停靠点/滑块位置都要按半个滑块内缩，首尾档位才与胶囊端头对齐。 */
export const THUMB_INSET = THUMB_SIZE / 2;

/** 第 index 个档位在轨道上的比例位置；只有一档时居中。 */
export function ratioOf(index: number, count: number): number {
	if (count <= 1) return 0.5;
	return index / (count - 1);
}

/** 比例 → 轨道内的中心位置（CSS 表达式）：扣除一个滑块直径后按比例分布。 */
export function centerAt(ratio: number): string {
	return `calc(${String(THUMB_INSET)}px + (100% - ${String(THUMB_SIZE)}px) * ${String(ratio)})`;
}

/** 第 index 个停靠点（刻度）的中心位置。 */
export function offsetOf(index: number, count: number): string {
	return centerAt(ratioOf(index, count));
}

/** 连续比例 → 最近的档位下标（松手时吸附用它）。 */
export function snapIndex(ratio: number, count: number): number {
	if (count <= 1) return 0;
	return Math.min(Math.max(Math.round(ratio * (count - 1)), 0), count - 1);
}
