import { useEffect } from "react";

export const N8N_CHAT_WEBHOOK_URL =
  "https://sanikausar.app.n8n.cloud/webhook/da35ba41-fad9-4c10-ab0a-bb0935624e83/chat";

declare global {
  interface Window {
    __n8nChatMounted?: boolean;
  }
}

export function N8nChatWidget() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Prevent duplicate injection
    if (window.__n8nChatMounted || document.getElementById("n8n-chat-script")) {
      return;
    }

    // Ensure stylesheet is loaded
    if (!document.getElementById("n8n-chat-css")) {
      const link = document.createElement("link");
      link.id = "n8n-chat-css";
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/@n8n/chat/dist/style.css";
      document.head.appendChild(link);
    }

    window.__n8nChatMounted = true;

    // Inject ESM module script to initialize n8n chat
    const script = document.createElement("script");
    script.id = "n8n-chat-script";
    script.type = "module";
    script.textContent = `
      import { createChat } from 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js';

      createChat({
        webhookUrl: '${N8N_CHAT_WEBHOOK_URL}',
        mode: 'window',
        initialMessages: [
          'Hello! I am the TA Bridals AI Studio Manager. How can I help you today?'
        ],
        i18n: {
          en: {
            title: 'TA Bridals Studio Manager',
            subtitle: 'Shoots, staff, payments and studio insights',
            inputPlaceholder: 'Ask about shoots, staff, payments...',
          },
        },
      });
    `;

    document.body.appendChild(script);

    return () => {
      // In persistent SPA, we allow chat window to persist across tabs
    };
  }, []);

  return null;
}
