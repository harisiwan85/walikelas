import adapterVercel from '@sveltejs/adapter-vercel';
import adapterNode from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const isVercel = process.env.VERCEL === '1';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: isVercel
			? adapterVercel({
					runtime: 'nodejs20.x'
			  })
			: adapterNode(),
		csrf: {
			// Upload bukti surat izin via multipart dari aplikasi web & Android
			checkOrigin: false
		}
	}
};

export default config;
