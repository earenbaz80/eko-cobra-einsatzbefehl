import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {execFileSync} from 'node:child_process';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

// SHA del commit que se está compilando: el humo remoto lo compara con lo que sirve
// Pages para no confundir el despliegue nuevo con el HTML cacheado anterior.
const shaDelBuild = (() => {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.trim();
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
  } catch {
    return 'desconocido';
  }
})();

const marcaDeBuild = (): Plugin => ({
  name: 'eko-marca-de-build',
  transformIndexHtml: (html) =>
    html.replace('</head>', `    <meta name="eko-build" content="${shaDelBuild}" />\n  </head>`),
});

export default defineConfig(() => {
  return {
    // En GitHub Pages el sitio cuelga de /eko-cobra-einsatzbefehl/; en local se queda en '/'.
    base: process.env.VITE_BASE_PATH ?? '/',
    plugins: [react(), tailwindcss(), marcaDeBuild()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'vendor';
            if (id.includes('node_modules/lucide-react') || id.includes('node_modules/motion')) return 'ui';
            return undefined;
          },
        },
      },
    },
  };
});
