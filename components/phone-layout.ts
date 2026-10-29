/**
 * Phone layout decisions (lh-m5s) — pure functions, no DOM. The client
 * provider (phone-layout-context.tsx) feeds them the live viewport; every
 * responsive surface reads the result instead of guessing from CSS.
 */

/** Below this width the 288px sidebar would squeeze the page under its
 *  640px floor (640 + 288). THE source of this number for everything in JS
 *  (sidebar.tsx imports it; it no longer keeps its own copy). Two mirrors
 *  cannot import it and must be changed with it: SIDEBAR_AUTOCLOSE in
 *  electron/main.cjs (a CJS main-process module) and the `max-width:
 *  927.98px` media query in app/globals.css (a media query cannot read TS). */
export const NARROW_WIDTH = 928;

/** desktop = inline sidebar; overlay = narrow browser, the session list
 *  floats over a full-width page; electron-narrow = the desktop shell's
 *  existing auto-close + window-widen path. */
export type ShellMode = "desktop" | "overlay" | "electron-narrow";

export type PhoneLayout = {
	shell: ShellMode;
	/** Enter in a text field types a newline; the Send/Submit buttons submit. */
	enterInsertsNewline: boolean;
	/** Settings and setup render as full-screen sheets. */
	sheetDialogs: boolean;
	/** The session title drops to the compact scale. */
	compactTitle: boolean;
	/** Control rows (stats, home mode/dictate/model) wrap instead of overflowing. */
	wrapControls: boolean;
	/** Graph tools: one row, or search alone above the other tools. */
	graphToolRows: 1 | 2;
	/** Node detail: anchored at the tap point, or pinned to the bottom. */
	nodeCard: "anchor" | "bottom-sheet";
};

export function phoneLayout(input: { width: number; electron: boolean; coarsePointer: boolean }): PhoneLayout {
	const narrow = input.width < NARROW_WIDTH;
	const shell: ShellMode = !narrow ? "desktop" : input.electron ? "electron-narrow" : "overlay";
	const overlay = shell === "overlay";
	return {
		shell,
		enterInsertsNewline: input.coarsePointer,
		sheetDialogs: overlay,
		compactTitle: overlay,
		wrapControls: overlay,
		graphToolRows: overlay ? 2 : 1,
		nodeCard: overlay ? "bottom-sheet" : "anchor",
	};
}

/** Whether the session list is showing. Desktop follows the persisted
 *  preference; Electron-narrow auto-closes; the overlay has its own
 *  transient state, so a stored "open" never covers a phone on arrival. */
export function sidebarOpen(input: { shell: ShellMode; preference: boolean; overlayOpen: boolean }): boolean {
	if (input.shell === "desktop") return input.preference;
	if (input.shell === "electron-narrow") return false;
	return input.overlayOpen;
}

/** What the sidebar toggle does in each shell. */
export function sidebarToggleAction(input: {
	shell: ShellMode;
	preference: boolean;
}): "flip-preference" | "flip-overlay" | "widen-window" {
	if (input.shell === "overlay") return "flip-overlay";
	if (input.shell === "electron-narrow" && !input.preference) return "widen-window";
	return "flip-preference";
}

export type OverlayDrawerEvent = "toggle" | "backdrop" | "navigate";

/** The overlay drawer's transient open state. */
export function overlayDrawer(open: boolean, event: OverlayDrawerEvent): boolean {
	return event === "toggle" ? !open : false;
}

/** How much of the layout viewport the on-screen keyboard covers. iOS keeps
 *  the layout viewport (and dvh) full height while the keyboard sits over its
 *  bottom, so the only honest reading is the visual viewport's shortfall; with
 *  the keyboard down only the home indicator needs clearing.
 *
 *  This is ONE number — the room the dock has lost. The dock's own height
 *  budget (components/dock-height.ts `dockHeightBudget`) takes it as an input
 *  and derives every cap from it; nothing here second-guesses that budget. */
export function keyboardInset(input: {
	layoutHeight: number;
	visualHeight: number;
	offsetTop: number;
	safeAreaBottom: number;
}): { bottomInset: number } {
	const overlap = Math.max(0, input.layoutHeight - input.visualHeight - input.offsetTop);
	return { bottomInset: overlap > 0 ? overlap : input.safeAreaBottom };
}

/** What Enter does in a text field. A phone keyboard has no Shift+Enter, so
 *  on a coarse pointer Enter types the newline and the Send/Submit button
 *  submits; ⌘/Ctrl+Enter submits everywhere. */
export function enterKey(input: {
	coarsePointer: boolean;
	shiftKey: boolean;
	metaKey: boolean;
	ctrlKey: boolean;
}): "newline" | "submit" {
	if (input.metaKey || input.ctrlKey) return "submit";
	if (input.coarsePointer || input.shiftKey) return "newline";
	return "submit";
}

/** Copy corners on code, tables, and math: hover-revealed where hover
 *  exists, always shown where it does not. */
export function copyVisibility(canHover: boolean): "visible" | "hover-reveal" {
	return canHover ? "hover-reveal" : "visible";
}

/** The confidence slider's hit box in px — a finger-sized target on touch;
 *  the painted rail never changes. */
export function confidenceHitHeight(coarsePointer: boolean): 44 | 16 {
	return coarsePointer ? 44 : 16;
}

/** Model menus: the 22rem desktop width, capped to the viewport with a
 *  12px gutter each side. */
export function modelMenuWidth(viewportWidth: number): number {
	return Math.min(352, viewportWidth - 24);
}

/** Travel in px that turns a press into a pan (the graph's click slop). */
export const GESTURE_SLOP = 4;
/** A still press held this long opens the node's context menu on touch. */
export const LONG_PRESS_MS = 500;

export function pointerGesture({ holdMs, travelPx }: { holdMs: number; travelPx: number }): "tap" | "pan" | "long-press" {
	if (travelPx >= GESTURE_SLOP) return "pan";
	if (holdMs >= LONG_PRESS_MS) return "long-press";
	return "tap";
}

/** The server render and the first client render (before the viewport is
 *  read) — the desktop app, so hydration matches today's markup. */
export const DESKTOP_LAYOUT: PhoneLayout = phoneLayout({ width: NARROW_WIDTH, electron: false, coarsePointer: false });
