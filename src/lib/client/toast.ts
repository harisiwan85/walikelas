import { writable } from 'svelte/store';

export interface Toast {
	id: number;
	message: string;
	type: 'success' | 'error';
}

export const toasts = writable<Toast[]>([]);
let nextId = 1;

export function toast(message: string, type: 'success' | 'error' = 'success') {
	const id = nextId++;
	toasts.update((t) => [...t, { id, message, type }]);
	setTimeout(() => toasts.update((t) => t.filter((x) => x.id !== id)), 3500);
}
