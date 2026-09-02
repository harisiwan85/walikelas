export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
	const res = await fetch(path, {
		headers: { 'Content-Type': 'application/json' },
		...options
	});
	if (!res.ok) {
		const body = await res.json().catch(() => null);
		throw new Error(body?.message ?? `Terjadi kesalahan (${res.status})`);
	}
	if (res.status === 204) return undefined as T;
	return res.json() as Promise<T>;
}

export async function upload<T>(path: string, form: FormData): Promise<T> {
	const res = await fetch(path, { method: 'POST', body: form });
	if (!res.ok) {
		const body = await res.json().catch(() => null);
		throw new Error(body?.message ?? `Terjadi kesalahan (${res.status})`);
	}
	return res.json() as Promise<T>;
}
