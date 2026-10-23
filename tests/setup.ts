import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
	cleanup();
});

if (typeof window !== 'undefined') {
	if (typeof window.PointerEvent === 'undefined') {
		// jsdom 30 still lacks PointerEvent; MouseEvent carries the fields we use.
		(window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = window.MouseEvent;
	}
	const proto = Element.prototype as Element & {
		setPointerCapture?: () => void;
		releasePointerCapture?: () => void;
		hasPointerCapture?: () => boolean;
	};
	if (typeof proto.setPointerCapture !== 'function') {
		Object.defineProperty(proto, 'setPointerCapture', { configurable: true, value: () => {} });
	}
	if (typeof proto.releasePointerCapture !== 'function') {
		Object.defineProperty(proto, 'releasePointerCapture', { configurable: true, value: () => {} });
	}
	if (typeof proto.hasPointerCapture !== 'function') {
		Object.defineProperty(proto, 'hasPointerCapture', { configurable: true, value: () => false });
	}
	if (typeof HTMLElement.prototype.scrollIntoView !== 'function') {
		Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: () => {} });
	}
}
