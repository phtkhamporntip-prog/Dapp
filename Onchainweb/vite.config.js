
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
    optimizeDeps: {
        include: ['@web3modal/ethers', 'ethers', 'ethers/lib/utils', '@wagmi/core', '@wagmi/connectors'],
        rolldownOptions: {
            plugins: [],
        },
    },
    build: {
        target: 'es2020',
        minify: 'oxc',
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) return undefined;

                    // Extract the exact top-level package name (handles scoped packages like @firebase/app)
                    const match = id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
                    if (!match) return undefined;
                    const pkg = match[1];

                    // React ecosystem (independent of wallet/ethers libraries)
                    if (['react', 'react-dom', 'react-router-dom', 'react-router', 'scheduler'].includes(pkg)) {
                        return 'vendor-react';
                    }
                    // Firebase SDK (independent of react/wallet)
                    if (pkg === 'firebase' || pkg.startsWith('@firebase/')) {
                        return 'vendor-firebase';
                    }
                    // Web3 / wallet ecosystem (wagmi, walletconnect, web3modal, viem, ethers)
                    // Kept together to avoid circular dependency issues since these libs interoperate
                    if (
                        pkg.startsWith('@wagmi/') ||
                        pkg.startsWith('@walletconnect/') ||
                        pkg.startsWith('@web3modal/') ||
                        pkg.startsWith('@reown/') ||
                        pkg === 'wagmi' ||
                        pkg === 'ethers' ||
                        pkg === 'viem' ||
                        pkg === 'ox'
                    ) {
                        return 'vendor-web3';
                    }
                },
            },
        },
        chunkSizeWarningLimit: 2500,
        sourcemap: false,
    },
    server: {
        port: 5173,
    },
    };
});
