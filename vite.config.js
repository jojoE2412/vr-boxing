import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { multiplayerServerPlugin } from './src/backend/multiplayerServer.js';

export default defineConfig({
    plugins: [
        basicSsl(),
        multiplayerServerPlugin()
    ],
    server: {
        host: '0.0.0.0',
        port: 4173,
        strictPort: true
    },
    preview: {
        host: '0.0.0.0',
        port: 4173,
        strictPort: true
    }
});