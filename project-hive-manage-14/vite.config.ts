import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { version } from './package.json'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  preview: {
    host: '0.0.0.0',
    port: process.env.PORT ? parseInt(process.env.PORT) : 4173,
    strictPort: true,
    allowedHosts: ['gestor-de-projetos-imi.onrender.com']
  },
  build: {
    // Otimizações de build
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: mode === 'production'
      }
    },
    rollupOptions: {
      output: {
        // Usar hash para cache busting
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
        // Otimizar chunks
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-aspect-ratio',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-tooltip',
          ],
          'utils-vendor': [
            'date-fns',
            'zod',
            'clsx',
            'tailwind-merge',
            'class-variance-authority',
            'lucide-react',
          ],
          'xlsx': ['xlsx'],
          'supabase': ['@supabase/supabase-js', '@supabase/postgrest-js'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    // Otimizações de performance
    cssCodeSplit: true,
    sourcemap: mode === 'development',
    // Otimizações de assets
    assetsInlineLimit: 4096,
    // Otimizações de CSS
    cssMinify: mode === 'production',
  },
  // Configurações para evitar problemas de cache
  optimizeDeps: {
    force: true,
    exclude: ['@supabase/supabase-js'],
    include: ['@supabase/postgrest-js'],
    esbuildOptions: {
      target: 'esnext',
      supported: {
        'top-level-await': true
      }
    }
  },
  // Configurações de servidor
  server: {
    hmr: {
      overlay: true
    },
    watch: {
      usePolling: true,
      ignored: [
        '**/.wwebjs_cache/**',
        '**/.wwebjs_auth/**'
      ]
    }
  },
  // Configurações específicas para o ambiente de produção
  define: {
    __APP_VERSION__: JSON.stringify(`${version}-${new Date().toISOString()}`),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __CACHE_BUSTER__: JSON.stringify(Date.now().toString()),
  },
  // Configurações para headers anti-cache
  experimental: {
    renderBuiltUrl(filename, { hostType }) {
      if (hostType === 'js') {
        return { relative: true };
      }
      return { relative: true };
    }
  },
}))
