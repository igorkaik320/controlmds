/**
 * Extension Shield — Proteção contra extensões de navegador (Chrome, Edge, Opera, Brave, Firefox, Safari)
 *
 * Muitas extensões (tradutores, bloqueadores, gerenciadores de senha, antivírus, "dark reader",
 * "grammarly", "honey", "metamask", etc.) injetam scripts e nós no DOM da página. Em SPAs React
 * isso causa:
 *   - Erros não capturados que travam o app inteiro
 *   - "Hydration / removeChild" errors em diffs do React
 *   - Tela branca logo após o login
 *
 * Esta camada NÃO bloqueia as extensões (o navegador não permite), ela apenas IGNORA tudo o que
 * vier delas para que o sistema continue funcionando normalmente em qualquer navegador.
 */

const EXTENSION_URL_PATTERNS = [
  'chrome-extension://',
  'moz-extension://',
  'safari-extension://',
  'safari-web-extension://',
  'edge-extension://',
  'extension://',
  'webkit-masked-url://',
];

const EXTENSION_ERROR_SIGNATURES = [
  // Erros comuns gerados por extensões
  'Extension context invalidated',
  'message channel closed',
  'A listener indicated an asynchronous response',
  'Could not establish connection. Receiving end does not exist',
  'chrome.runtime',
  'browser.runtime',
  'Cannot access contents of url',
  'ResizeObserver loop',
  'ResizeObserver loop completed with undelivered notifications',
  // React reclamando de nós que extensões inseriram/removeram
  "Failed to execute 'removeChild' on 'Node'",
  "Failed to execute 'insertBefore' on 'Node'",
  'The node to be removed is not a child of this node',
  'NotFoundError: The object can not be found here',
];

function isFromExtension(source?: string | null, message?: string | null, stack?: string | null): boolean {
  const haystack = `${source ?? ''} ${message ?? ''} ${stack ?? ''}`.toLowerCase();
  if (EXTENSION_URL_PATTERNS.some((p) => haystack.includes(p))) return true;
  if (EXTENSION_ERROR_SIGNATURES.some((sig) => haystack.includes(sig.toLowerCase()))) return true;
  return false;
}

export function isExtensionError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as any;
  const msg = typeof err === 'string' ? err : anyErr?.message ?? '';
  const stack = anyErr?.stack ?? '';
  const fileName = anyErr?.fileName ?? anyErr?.filename ?? '';
  return isFromExtension(fileName, msg, stack);
}

let installed = false;

export function installExtensionShield() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  // 1) Erros síncronos
  window.addEventListener(
    'error',
    (event) => {
      const src = event.filename;
      const msg = event.message;
      const stack = event.error?.stack;
      if (isFromExtension(src, msg, stack)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        // eslint-disable-next-line no-console
        console.warn('[ExtensionShield] erro de extensão ignorado:', msg);
        return false;
      }
    },
    true,
  );

  // 2) Promises rejeitadas (a maior parte dos crashes de extensão vem por aqui)
  window.addEventListener(
    'unhandledrejection',
    (event) => {
      const reason: any = event.reason;
      const msg = typeof reason === 'string' ? reason : reason?.message ?? '';
      const stack = reason?.stack ?? '';
      if (isFromExtension(undefined, msg, stack)) {
        event.preventDefault();
        // eslint-disable-next-line no-console
        console.warn('[ExtensionShield] promise de extensão ignorada:', msg);
      }
    },
    true,
  );

  // 3) Patch defensivo em Node.removeChild / insertBefore — extensões frequentemente movem nós
  //    que o React acha que ainda possui, e o diff explode com NotFoundError.
  try {
    const originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function <T extends Node>(child: T): T {
      try {
        if (child && child.parentNode !== this) {
          // Nó já foi removido (provavelmente por uma extensão). Não relança — só devolve.
          // eslint-disable-next-line no-console
          console.warn('[ExtensionShield] removeChild em nó órfão (provável extensão) — ignorado');
          return child;
        }
        return originalRemoveChild.call(this, child) as T;
      } catch (err) {
        if (isExtensionError(err)) {
          console.warn('[ExtensionShield] removeChild falhou por extensão — ignorado');
          return child;
        }
        throw err;
      }
    };

    const originalInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function <T extends Node>(newNode: T, refNode: Node | null): T {
      try {
        if (refNode && refNode.parentNode !== this) {
          // Referência foi mexida por extensão — anexa no final em vez de quebrar.
          return this.appendChild(newNode) as unknown as T;
        }
        return originalInsertBefore.call(this, newNode, refNode) as T;
      } catch (err) {
        if (isExtensionError(err)) {
          console.warn('[ExtensionShield] insertBefore falhou por extensão — fallback appendChild');
          try {
            return this.appendChild(newNode) as unknown as T;
          } catch {
            return newNode;
          }
        }
        throw err;
      }
    };
  } catch (err) {
    console.warn('[ExtensionShield] não foi possível instalar patch de DOM:', err);
  }

  // eslint-disable-next-line no-console
  console.log('🛡️ ExtensionShield ativo — compatível com Chrome, Edge, Opera, Brave, Firefox, Safari');
}
