import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

export default defineConfig({
	base: '/onemobility-platform/',
	plugins: [react()],
	server: {
		port: 5174,
	},
})
