import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupGlobalErrorHandling } from "./lib/safeUtils";

// Ativar tratamento global de erros
console.log('🔧 Ativando tratamento global de erros...');
setupGlobalErrorHandling();
console.log('✅ Tratamento global de erros ativado!');

createRoot(document.getElementById("root")!).render(<App />);
