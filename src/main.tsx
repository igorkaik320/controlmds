import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupGlobalErrorHandling } from "./lib/safeUtils";
import { installExtensionShield } from "./lib/extensionShield";

document.documentElement.classList.remove("dark");
document.documentElement.style.colorScheme = "light";
localStorage.setItem("theme", "light");

// Proteção contra extensões de navegador (Chrome, Edge, Opera, Brave, Firefox, Safari)
// DEVE rodar antes de qualquer outro código de erro / renderização.
installExtensionShield();

// Ativar tratamento global de erros
console.log('🔧 Ativando tratamento global de erros...');
setupGlobalErrorHandling();
console.log('✅ Tratamento global de erros ativado!');

createRoot(document.getElementById("root")!).render(<App />);
