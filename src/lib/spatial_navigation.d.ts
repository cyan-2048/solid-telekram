/*
 * A typescript definitions of Spatial Navigation implementation.
 *
 * Copyright (c) 2022 Ignatkovich Valery.
 *
 * Licensed under the MPL 2.0.
 */

export type Restrict = "self-first" | "self-only" | "none";

export type Direction = "left" | "right" | "up" | "down";

export type Selector = string;

export type Filter = (elem: HTMLElement) => void;

export type Cause = "keydown" | "api";

export interface Configuration {
	selector?: Selector;
	straightOnly?: boolean;
	straightOverlapThreshold?: number;
	rememberSource?: boolean;
	disabled?: boolean;
	defaultElement?: Selector;
	enterTo?: string;
	leaveFor?: null | Partial<Record<Direction, string>>;
	restrict?: Restrict;
	tabIndexIgnoreList?: Selector;
	navigableFilter?: Filter;
}

export interface WillMoveEvent extends Event {
	detail: {
		cause: Cause;
		sectionId: string;
		direction: Direction;
	};
}

export interface WillMoveEvent extends Event {
	detail: {
		cause: Cause;
		sectionId: string;
		direction: Direction;
	};
}

export interface WillMoveEvent extends Event {
	detail: {
		cause: Cause;
		sectionId: string;
		direction: Direction;
	};
}

export interface WillMoveEvent extends Event {
	detail: {
		cause: Cause;
		sectionId: string;
		direction: Direction;
	};
}

export interface WillUnFocusEvent extends Event {
	detail: {
		nextElement: Element;
		nextSectionId: string;
		direction: Direction;
		native: boolean;
	};
}

export interface UnFocusedEvent extends Event {
	detail: {
		nextElement: Element;
		nextSectionId: string;
		direction: Direction;
		native: boolean;
	};
}

export interface WillFocusEvent extends Event {
	detail: {
		sectionId: string;
		previousElement: Element;
		direction: Direction;
		native: boolean;
	};
}

export interface NavigateFailedEvent extends Event {
	detail: {
		direction: Direction;
	};
}

export interface SpatialNavigationEventMap {
	"sn-willmove": WillMoveEvent;
	"sn-willunfocus": WillUnFocusEvent;
	"sn-unfocused": UnFocusedEvent;
	"sn-willfocus": WillFocusEvent;
	"sn-focused": Event;
	"sn-navigatefailed": NavigateFailedEvent;
	"sn-enter-down": Event;
	"sn-enter-up": Event;
	keydown: KeyboardEvent;
}

declare module "solid-js" {
	namespace JSX {
		interface CustomEvents extends SpatialNavigationEventMap {}
		interface CustomCaptureEvents extends SpatialNavigationEventMap {}
	}
}

export interface SpatialNavigation {
	init(): void;

	uninit(): void;

	clear(): void;

	set(config: Configuration): any;

	set(sectionId: string, config: Configuration): any;

	add(config: Configuration): any;

	add(sectionId: string, config: Configuration): any;

	remove(sectionId: string): boolean;

	disable(sectionId: string): boolean;

	enable(sectionId: string): boolean;

	pause(): void;

	resume(): void;

	focus(sectionId?: string, silent?: any): boolean;

	focus(selector?: string, silent?: any): boolean;

	move(direction: Direction, selector?: string): boolean;

	makeFocusable(sectionId?: string): void;

	setDefaultSection(sectionId?: string): void;
}

declare var SpatialNavigation: SpatialNavigation;

declare global {
	interface HTMLElement {
		addEventListener<K extends keyof SpatialNavigationEventMap>(
			type: K,
			listener: (this: HTMLElement, ev: SpatialNavigationEventMap[K]) => any,
			options?: boolean | AddEventListenerOptions
		): void;
	}

	interface Window {
		SpatialNavigation: SpatialNavigation;
	}
}

export default SpatialNavigation;
