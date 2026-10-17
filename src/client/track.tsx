/**
 * 档位轨道：品牌色进度填充 + 离散停靠点 + 连续跟手的白色滑块。
 *
 * 三个不变量（`tools/verify.mjs` 第 7、8b 组盯着它们）：
 *   · 子节点顺序是「填充 → 停靠点 → 滑块」，最后一个永远是滑块（拖动相关的断言按这个取）；
 *   · 填充的 `width` 与滑块的 `left` **必须同源**（都用 `centerAt(ratio)`），否则接缝会露出来；
 *   · 拖动中两者都关掉 `transition`，否则动画会拖在手速后面。
 */

import type { PointerEvent, RefObject } from 'react';
import { h } from './platform';
import { centerAt, offsetOf } from './geometry';
import { styles } from './styles';
import type { EffortLevel } from './model';

export interface EffortTrackProps {
	trackRef: RefObject<HTMLDivElement>;
	thumbRef: RefObject<HTMLSpanElement>;
	fillRef: RefObject<HTMLSpanElement>;
	efforts: EffortLevel[];
	/** 当前预览档位（拖动中是最近的停靠点），-1 表示没有可用的档位。 */
	previewIndex: number;
	/** 滑块/填充所在的连续比例；`null` 表示不显示（没有档位）。 */
	shownRatio: number | null;
	dragging: boolean;
	locked: boolean;
	onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
	onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
	onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
}

/** 轨道本体。 */
export function EffortTrack(props: EffortTrackProps) {
	const count = props.efforts.length;

	const ticks = [];
	for (let index = 0; index < count; index += 1) {
		ticks.push(<span key={`tick-${props.efforts[index].id}`} style={{ ...styles.tick, left: offsetOf(index, count) }} />);
	}

	// 拖动时滑块与填充都按连续比例跟手，静止时停在当前档位。
	const thumb =
		props.shownRatio === null ? null : (
			<span
				ref={props.thumbRef}
				style={{
					...styles.thumb,
					...(props.dragging ? styles.thumbActive : {}),
					left: centerAt(props.shownRatio),
					// 拖动时 left 由 pointermove 直接写（要的是零延迟），所以过渡只留给"放大"这一下。
					transform: `translate(-50%, -50%) scale(${props.dragging ? '1.06' : '1'})`,
					transition: props.dragging
						? 'transform .12s ease-out'
						: 'left .12s ease-out, transform .12s ease-out',
				}}
			/>
		);

	// 进度填充：宽度 = 滑块中心距轨道左端的距离。右端永远被滑块盖住，
	// 所以两者只要用同一个 centerAt(ratio) 就不会错位。
	const fill =
		props.shownRatio === null ? null : (
			<span
				ref={props.fillRef}
				style={{
					...styles.fill,
					width: centerAt(props.shownRatio),
					transition: props.dragging ? 'none' : 'width .12s ease-out',
				}}
			/>
		);

	return (
		<div
			ref={props.trackRef}
			role="slider"
			tabIndex={props.locked ? -1 : 0}
			aria-label="推理等级"
			aria-valuemin={1}
			aria-valuemax={count}
			aria-valuenow={props.previewIndex >= 0 ? props.previewIndex + 1 : undefined}
			aria-valuetext={props.previewIndex >= 0 ? props.efforts[props.previewIndex].name : '未设置'}
			style={{
				...styles.track,
				...(props.locked ? styles.trackDisabled : {}),
				cursor: props.locked ? 'default' : props.dragging ? 'grabbing' : 'pointer',
			}}
			onPointerDown={props.onPointerDown}
			onPointerMove={props.onPointerMove}
			onPointerUp={props.onPointerUp}
			onPointerCancel={props.onPointerUp}
		>
			{fill}
			{ticks}
			{thumb}
		</div>
	);
}
