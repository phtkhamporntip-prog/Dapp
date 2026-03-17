
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

/**
 * Vite plugin — builds the Firebase Messaging service worker from a template,
 * injecting the VITE_FIREBASE_* env vars so the SW can initialise Firebase.
 * Works in both dev (middleware) and production (generateBundle).
 */
function firebaseMessagingSWPlugin(env) {
    const SW_TEMPLATE = path.resolve(__dirname, 'src/__sw__/firebase-messaging-sw.js');
    const SW_OUT_NAME = 'firebase-messaging-sw.js';

    const applyEnv = (source) =>
        source
            .replace(/__VITE_FIREBASE_API_KEY__/g,            env.VITE_FIREBASE_API_KEY            || '')
            .replace(/__VITE_FIREBASE_AUTH_DOMAIN__/g,        env.VITE_FIREBASE_AUTH_DOMAIN        || '')
            .replace(/__VITE_FIREBASE_PROJECT_ID__/g,         env.VITE_FIREBASE_PROJECT_ID         || '')
            .replace(/__VITE_FIREBASE_STORAGE_BUCKET__/g,     env.VITE_FIREBASE_STORAGE_BUCKET     || '')
            .replace(/__VITE_FIREBASE_MESSAGING_SENDER_ID__/g, env.VITE_FIREBASE_MESSAGING_SENDER_ID || '')
            .replace(/__VITE_FIREBASE_APP_ID__/g,             env.VITE_FIREBASE_APP_ID             || '');

    return {
        name: 'firebase-messaging-sw',
        // Dev: serve the processed SW via the Vite dev server
        configureServer(server) {
            server.middlewares.use(`/${SW_OUT_NAME}`, (_req, res) => {
                try {
                    const template = fs.readFileSync(SW_TEMPLATE, 'utf-8');
                    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
                    res.setHeader('Service-Worker-Allowed', '/');
                    res.end(applyEnv(template));
                } catch (e) {
                    res.statusCode = 500;
                    res.end(`/* FCM SW template error: ${e.message} */`);
                }
            });
        },
        // Production: emit the processed SW as a root-level asset
        generateBundle() {
            const template = fs.readFileSync(SW_TEMPLATE, 'utf-8');
            this.emitFile({
                type: 'asset',
                fileName: SW_OUT_NAME,
                source: applyEnv(template),
            });
        },
    };
}

export default defineConfig(({ mode }) => {
    // Load env from Onchainweb/.env* files, also captures system env vars set by Vercel
    const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };

    return {
    plugins: [react(), firebaseMessagingSWPlugin(env)],
    base: '/',
    resolve: {
        alias: {
            '@wagmi/core': path.resolve(__dirname, 'node_modules/@wagmi/core'),
            '@wagmi/connectors': path.resolve(__dirname, 'node_modules/@wagmi/connectors'),
        },
    },
    esbuild: {
        loader: 'jsx',
        include: /src\/.*\.jsx?$/,
        exclude: [],
        drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    },
    optimizeDeps: {
        include: ['@web3modal/ethers', 'ethers', 'ethers/lib/utils', '@wagmi/core', '@wagmi/connectors'],
        esbuildOptions: {
            loader: {
                '.js': 'jsx',
            },
        },
    },
    build: {
        target: 'es2020',
        minify: 'esbuild',
        esbuildOptions: {
            drop: ['console', 'debugger'],
            legalComments: 'none',
        },
        rollupOptions: {
            // No externals - bundle everything for browser
        },
        chunkSizeWarningLimit: 3000,
        sourcemap: false,
    },
    server: {
        port: 5173,
    },
    };
});
