import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { buildConfidenceDiagnostics, stage2DiagnosticsData } from './src/stage2Diagnostics.js';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'stage2-confidence-diagnostics-endpoint',
      configureServer(server) {
        server.middlewares.use('/api/debug/stage2/confidence-diagnostics', (req, res) => {
          const url = new URL(req.url || '', 'http://localhost');
          const limit = url.searchParams.get('limit');
          const response = buildConfidenceDiagnostics(stage2DiagnosticsData, limit);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(response, null, 2));
        });
      },
    },
  ],
});
