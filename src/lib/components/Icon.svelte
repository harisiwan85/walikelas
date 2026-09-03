<script lang="ts">
	interface IconDef {
		paths?: string[];
		circles?: [number, number, number][];
		lines?: [number, number, number, number][];
		polylines?: string[];
		rects?: [number, number, number, number, number?][];
	}

	const icons: Record<string, IconDef> = {
		dashboard: {
			rects: [
				[3, 3, 7, 9],
				[14, 3, 7, 5],
				[14, 12, 7, 9],
				[3, 16, 7, 5]
			]
		},
		absensi: {
			polylines: ['9 11 12 14 22 4'],
			paths: ['M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11']
		},
		siswa: {
			paths: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
			circles: [[9, 7, 4]]
		},
		kelas: {
			paths: ['M22 10L12 5 2 10v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2z'],
			lines: [
				[6, 12, 6, 22],
				[18, 12, 18, 22]
			]
		},
		guru: {
			paths: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'],
			circles: [[12, 7, 4]]
		},
		mapel: {
			paths: ['M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z', 'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z']
		},
		sekolah: {
			paths: ['m4 10 8-6 8 6v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z', 'M9 21v-6h6v6', 'M12 8v2']
		},
		laporan: {
			lines: [
				[12, 20, 12, 10],
				[18, 20, 18, 4],
				[6, 20, 6, 16]
			]
		},
		riwayat: {
			paths: ['M12 6v6l4 2'],
			circles: [[12, 12, 10]]
		},
		kalender: {
			rects: [
				[3, 4, 18, 18, 2]
			],
			lines: [
				[16, 2, 16, 6],
				[8, 2, 8, 6],
				[3, 10, 21, 10]
			]
		},
		jurnal: {
			paths: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6'],
			lines: [
				[16, 13, 8, 13],
				[16, 17, 8, 17],
				[10, 9, 8, 9]
			]
		},
		logout: {
			paths: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
			polylines: ['16 17 21 12 16 7']
		},
		plus: {
			lines: [
				[12, 5, 12, 19],
				[5, 12, 19, 12]
			]
		},
		download: {
			paths: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'],
			polylines: ['7 10 12 15 17 10', '12 15 12 3']
		},
		upload: {
			paths: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'],
			polylines: ['17 8 12 3 7 8', '12 3 12 15']
		},
		alert: {
			paths: ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'],
			lines: [
				[12, 9, 12, 13],
				[12, 17, 12.01, 17]
			]
		},
		save: {
			paths: ['M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z', 'M17 21v-8H7v8'],
			polylines: ['7 3 7 8 15 8']
		},
		search: {
			paths: [],
			circles: [[11, 11, 8]],
			lines: [
				[21, 21, 16.65, 16.65]
			]
		},
		edit: {
			paths: ['M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7', 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z']
		},
		trash: {
			paths: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
			polylines: ['3 6 5 6 21 6']
		},
		x: {
			lines: [
				[18, 6, 6, 18],
				[6, 6, 18, 18]
			]
		},
		check: {
			polylines: ['20 6 9 17 4 12']
		},
		bell: {
			paths: ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 0 1-3.46 0']
		},
		send: {
			paths: ['M22 2L11 13'],
			polylines: ['22 2 15 22 11 13 2 9 22 2']
		},
		phone: {
			paths: [
				'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'
			]
		},
		mail: {
			paths: ['M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z'],
			polylines: ['22 6 12 13 2 6']
		},
		lock: {
			rects: [
				[3, 11, 18, 11, 2]
			],
			paths: ['M7 11V7a5 5 0 0 1 10 0v4'],
			lines: [
				[12, 15, 12, 17]
			]
		},
		eye: {
			paths: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'],
			circles: [[12, 12, 3]]
		},
		'eye-off': {
			paths: ['M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24'],
			lines: [
				[1, 1, 23, 23]
			]
		},
		user: {
			paths: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'],
			circles: [[12, 7, 4]]
		},
		camera: {
			paths: ['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z'],
			circles: [[12, 13, 4]]
		},
		trending: {
			polylines: ['23 6 13.5 15.5 8.5 10.5 1 18', '17 6 23 6 23 12']
		},
		shield: {
			paths: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z']
		},
		info: {
			paths: [],
			circles: [[12, 12, 10]],
			lines: [
				[12, 16, 12, 12],
				[12, 8, 12.01, 8]
			]
		},
		heart: {
			paths: ['M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z']
		},
		clock: {
			paths: ['M12 6v6l4 2'],
			circles: [[12, 12, 10]]
		},
		'user-x': {
			paths: ['M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M17 8l5 5', 'M22 8l-5 5'],
			circles: [[8, 7, 4]]
		},
		'file-text': {
			paths: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6'],
			lines: [
				[16, 13, 8, 13],
				[10, 17, 8, 17]
			]
		},
		database: {
			paths: [
				'M3 5a9 3 0 0 1 18 0c0 1.66-4.03 3-9 3S3 6.66 3 5z',
				'M3 5v14a9 3 0 0 0 18 0V5',
				'M3 12a9 3 0 0 0 18 0'
			]
		},
		more: {
			circles: [
				[12, 5, 1.5],
				[12, 12, 1.5],
				[12, 19, 1.5]
			]
		},
		'chevron-left': {
			polylines: ['15 18 9 12 15 6']
		},
		'chevron-right': {
			polylines: ['9 18 15 12 9 6']
		},
		'chevrons-left': {
			polylines: ['11 17 6 12 11 7', '18 17 13 12 18 7']
		},
		'chevrons-right': {
			polylines: ['13 17 18 12 13 7', '6 17 11 12 6 7']
		}
	};

	let { name, class: cls = 'w-4 h-4' }: { name: string; class?: string } = $props();

	const def = icons[name] ?? icons.info;
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	class={cls}
	aria-hidden="true"
>
	{#each def.paths ?? [] as p}
		<path d={p} />
	{/each}
	{#each def.circles ?? [] as c}
		<circle cx={c[0]} cy={c[1]} r={c[2]} />
	{/each}
	{#each def.lines ?? [] as l}
		<line x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} />
	{/each}
	{#each def.polylines ?? [] as pl}
		<polyline points={pl} />
	{/each}
	{#each def.rects ?? [] as r}
		<rect x={r[0]} y={r[1]} width={r[2]} height={r[3]} rx={r[4] ?? 0} />
	{/each}
</svg>
