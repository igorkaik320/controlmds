import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const fixedSupabaseEnv = {
  "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify("ufzouwmdnerldugfovsj"),
  "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify("sb_publishable_jNNfHeN_6mEcpnzucyL4Hg_WJK6_y_D"),
  "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://ufzouwmdnerldugfovsj.supabase.co"),
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
  build: {
    target: "es2020",
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "supabase": ["@supabase/supabase-js"],
          "query": ["@tanstack/react-query"],
          "radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-popover",
            "@radix-ui/react-tabs",
          ],
          "pdf": ["jspdf", "jspdf-autotable"],
          "excel": ["xlsx"],
          "charts": ["recharts"],
          "icons": ["lucide-react"],
          "date": ["date-fns"],
        },
      },
    },
  },
}));
