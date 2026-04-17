import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const fixedSupabaseEnv = {
  "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify("nrdgikombmiqbanjgbav"),
  "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yZGdpa29tYm1pcWJhbmpnYmF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NDY0NDIsImV4cCI6MjA5MDAyMjQ0Mn0.fudzUm5mLdLAo2hiHQH2En2G6UdJPW99yd03rXAD9mg"),
  "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://nrdgikombmiqbanjgbav.supabase.co"),
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: fixedSupabaseEnv,
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
