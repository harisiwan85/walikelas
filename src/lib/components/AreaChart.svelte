<script lang="ts">
	interface TrendPoint {
		tanggal: string;
		hadir: number;
		sakit: number;
		izin: number;
		alpa: number;
		terlambat: number;
		total: number;
	}

	let {
		data,
		height = 180,
		showLegend = true
	}: { data: TrendPoint[]; height?: number; showLegend?: boolean } = $props();

	const W = 640;
	const H = height;
	const padL = 30;
	const padB = 22;
	const padT = 12;

	const series = [
		{ key: 'hadir', color: '#10b981', label: 'Hadir' },
		{ key: 'sakit', color: '#f59e0b', label: 'Sakit' },
		{ key: 'izin', color: '#0ea5e9', label: 'Izin' },
		{ key: 'alpa', color: '#f43f5e', label: 'Alpa' },
		{ key: 'terlambat', color: '#f97316', label: 'Terlambat' }
	] as const;

	let maxVal = $derived(Math.max(1, ...data.map((d) => d.total)));
	let plotW = $derived(W - padL);
	let plotH = $derived(H - padT - padB);
	let groupW = $derived(data.length ? plotW / data.length : 0);

	let labels = $derived(
		data.map((d) => {
			const [, m, day] = d.tanggal.split('-');
			return `${day}/${m}`;
		})
	);

	// lapisan bertumpuk (stacked): bottom..top per titik per seri
	let layers = $derived(
		data.map((d) => {
			let cum = 0;
			return series.map((s) => {
				const v = d[s.key];
				const layer = { bottom: cum, top: cum + v, value: v };
				cum += v;
				return layer;
			});
		})
	);

	function x(i: number): number {
		return padL + groupW * i + groupW / 2;
	}

	function y(v: number): number {
		return padT + plotH - (v / maxVal) * plotH;
	}

	// area tertutup untuk seri ke-j (antara lapisan bawah & atasnya)
	function areaPath(j: number): string {
		const n = data.length;
		let d = `M ${x(0).toFixed(1)} ${y(layers[0][j].top).toFixed(1)}`;
		for (let i = 1; i < n; i++) d += ` L ${x(i).toFixed(1)} ${y(layers[i][j].top).toFixed(1)}`;
		d += ` L ${x(n - 1).toFixed(1)} ${y(layers[n - 1][j].bottom).toFixed(1)}`;
		for (let i = n - 2; i >= 0; i--) d += ` L ${x(i).toFixed(1)} ${y(layers[i][j].bottom).toFixed(1)}`;
		d += ' Z';
		return d;
	}

	// garis atas seri (untuk stroke)
	function topPath(j: number): string {
		return data.map((_, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(layers[i][j].top).toFixed(1)}`).join(' ');
	}
</script>

<svg viewBox="0 0 {W} {H}" class="w-full" role="img" aria-label="Grafik tren kehadiran">
	<defs>
		{#each series as s, j}
			<linearGradient id={`area-${j}`} x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color={s.color} stop-opacity="0.45" />
				<stop offset="100%" stop-color={s.color} stop-opacity="0.04" />
			</linearGradient>
		{/each}
	</defs>

	{#each [0, 0.25, 0.5, 0.75, 1] as g}
		<line x1={padL} y1={padT + plotH * (1 - g)} x2={W} y2={padT + plotH * (1 - g)} stroke="#e2e8f0" stroke-width="1" />
		<text x="2" y={padT + plotH * (1 - g) + 3} font-size="8" fill="#94a3b8">
			{Math.round(maxVal * g)}
		</text>
	{/each}

	{#each series as s, j}
		<path d={areaPath(j)} fill={`url(#area-${j})`}>
			<title>{labels.join(', ')}</title>
		</path>
		<path d={topPath(j)} fill="none" stroke={s.color} stroke-width="1.5" stroke-linejoin="round">
			{#each data as d, i}
				<title>{labels[i]} — {s.label}: {d[s.key]}</title>
			{/each}
		</path>
	{/each}

	{#each data as d, i}
		<text x={x(i)} y={H - 6} font-size="8" fill="#94a3b8" text-anchor="middle">
			{labels[i]}
		</text>
	{/each}
</svg>

{#if showLegend}
	<div class="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
		{#each series as s}
			<span class="inline-flex items-center gap-1.5">
				<span class="w-2.5 h-2.5 rounded-sm inline-block" style="background:{s.color}"></span>
				{s.label}
			</span>
		{/each}
	</div>
{/if}
