/**
 * ai-widget.js
 * FlopSource — Floating AI Consultation Widget (bottom-right collapsible)
 * Extracted for modularity and to isolate the open-ended project recommendation flow.
 */

(() => {
  'use strict';

  // The email lead gate (shared email grabber + "after 3 comparisons" logic)
  // now lives in lead-gate.js (loaded earlier in the page). We consume it here.
  function getLeadGate() {
    return window.FlopSourceLeadGate || null;
  }

  function initFloatingAIConsultationWidget() {
    const FAB_SIZE = 52;
    const PANEL_WIDTH = 380;

    // Create FAB (collapsed state) — pill style with text
    const fab = document.createElement('button');
    fab.id = 'ai-consult-fab';
    fab.setAttribute('aria-label', 'Open AI Consultation');
    fab.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      height: 42px;
      padding: 0 16px 0 12px;
      border-radius: 9999px;
      background: var(--accent);
      color: white;
      border: none;
      box-shadow: 0 10px 30px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1) inset;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      z-index: 450;
      transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s;
      white-space: nowrap;
    `;
    fab.innerHTML = `<i class="fa-solid fa-comments" style="font-size:17px;"></i> <span>AI Consultation</span>`;

    // Create expanded panel
    const panel = document.createElement('div');
    panel.id = 'ai-consult-widget';
    panel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: ${PANEL_WIDTH}px;
      max-height: 70vh;
      background: var(--bg-surface);
      border: 1px solid var(--border-md);
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.35);
      display: none;
      flex-direction: column;
      overflow: hidden;
      z-index: 460;
      font-size: 0.9rem;
    `;

    panel.innerHTML = `
      <!-- Header -->
      <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--bg-inner); border-bottom:1px solid var(--border-md);">
        <div style="display:flex; align-items:center; gap:8px; font-weight:600; color:var(--text-primary);">
          <i class="fa-solid fa-comments" style="color:var(--accent);"></i>
          <span>AI Consultation</span>
        </div>
        <div style="display:flex; gap:4px;">
          <button id="ai-widget-new-chat" class="btn-ghost" style="font-size:0.72rem; padding:2px 8px;" title="Start a new conversation">
            New Chat
          </button>
          <button id="ai-widget-minimize" class="btn-ghost" style="width:28px;height:28px;font-size:13px;padding:0;" title="Minimize">
            <i class="fa-solid fa-minus"></i>
          </button>
          <button id="ai-widget-close" class="btn-ghost" style="width:28px;height:28px;font-size:14px;padding:0;" title="Close">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
      </div>

      <!-- Chat Log -->
      <div id="ai-chat-log" style="flex:1; overflow:auto; padding:16px; display:flex; flex-direction:column; gap:12px; background:var(--bg-inner); font-size:0.9rem; line-height:1.45;"></div>

      <!-- Input Area -->
      <div style="padding:12px 14px; border-top:1px solid var(--border-md); background:var(--bg-surface);">
        <div style="font-size:0.7rem; color:var(--text-secondary); margin-bottom:4px;">
          Describe your workload. I'll ask follow-up questions to give you a better recommendation.
        </div>
        <div style="display:flex; gap:8px; align-items:flex-end;">
          <textarea id="ai-widget-textarea" rows="2" placeholder="E.g. We need to fine-tune a 70B model with strict EU data residency and occasional large bursts..." style="
            flex:1; resize:vertical; min-height:52px; font-family:inherit; font-size:0.85rem;
            padding:8px 11px; border:1px solid var(--border-md); border-radius:10px;
            background:var(--bg-inner); color:var(--text-primary); line-height:1.35;
          "></textarea>
          <button id="ai-widget-send" class="btn" style="padding:8px 18px; font-size:0.85rem; font-weight:600; white-space:nowrap;">
            Send
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    // State
    let isOpen = localStorage.getItem('flopsource-ai-widget-open') === 'true';

    function showPanel() {
      fab.style.display = 'none';
      panel.style.display = 'flex';
      isOpen = true;
      localStorage.setItem('flopsource-ai-widget-open', 'true');
    }

    function hidePanel() {
      panel.style.display = 'none';
      fab.style.display = 'flex';
      isOpen = false;
      localStorage.setItem('flopsource-ai-widget-open', 'false');
    }

    // FAB click — gated behind the shared email grabber (lead-gen)
    fab.onclick = () => {
      const gate = getLeadGate();
      if (gate && typeof gate.requireThen === 'function') {
        gate.requireThen(() => showPanel());
      } else {
        showPanel(); // graceful fallback if gate script not loaded
      }
    };

    // Panel controls
    panel.querySelector('#ai-widget-minimize').onclick = hidePanel;
    panel.querySelector('#ai-widget-close').onclick = hidePanel;

    // Initial state: only auto-open the panel if user already provided email previously.
    // New visitors always see the FAB first (they must pass the grabber on click).
    const hadPreviousOpen = isOpen;
    const gateForInit = getLeadGate();
    if (hadPreviousOpen && gateForInit && typeof gateForInit.hasEmail === 'function' && gateForInit.hasEmail()) {
      showPanel();
    } else {
      fab.style.display = 'flex';
      panel.style.display = 'none';
    }

    // Conversational state
    let conversationHistory = [];
    const chatLog = panel.querySelector('#ai-chat-log');
    const textarea = panel.querySelector('#ai-widget-textarea');
    const sendBtn = panel.querySelector('#ai-widget-send');
    const newChatBtn = panel.querySelector('#ai-widget-new-chat');

    function renderChatLog() {
      chatLog.innerHTML = '';
      conversationHistory.forEach(msg => {
        if (msg.role === 'system') return; // don't show system

        const isUser = msg.role === 'user';
        const bubble = document.createElement('div');
        bubble.style.cssText = `
          max-width: 85%;
          padding: 10px 14px;
          border-radius: 14px;
          white-space: pre-wrap;
          line-height: 1.45;
          ${isUser 
            ? 'align-self: flex-end; background: var(--accent); color: white; border-bottom-right-radius: 4px;' 
            : 'align-self: flex-start; background: var(--bg-surface); border: 1px solid var(--border-md); border-bottom-left-radius: 4px;'}
        `;
        bubble.textContent = msg.content;
        chatLog.appendChild(bubble);
      });
      chatLog.scrollTop = chatLog.scrollHeight;
    }

    function addMessageToHistory(role, content) {
      conversationHistory.push({ role, content });
      renderChatLog();
    }

    async function sendMessage() {
      const userText = textarea.value.trim();
      if (!userText) return;

      const API = window.FlopSourceAPI || {};

      // Add user message
      addMessageToHistory('user', userText);
      textarea.value = '';
      sendBtn.disabled = true;

      // Prepare messages for the API (include system prompt on first message)
      let messagesToSend = [...conversationHistory];

      // If this is the first real exchange, prepend a good system prompt
      if (conversationHistory.filter(m => m.role !== 'system').length === 1) {
        const systemPrompt = API.getConsultationSystemPrompt 
          ? API.getConsultationSystemPrompt() 
          : 'You are a helpful AI infrastructure consultant. Ask clarifying questions and give thoughtful recommendations.';
        
        messagesToSend = [
          { role: 'system', content: systemPrompt },
          ...conversationHistory
        ];
      }

      // Show typing indicator
      const typing = document.createElement('div');
      typing.style.cssText = 'align-self:flex-start; color:var(--text-secondary); font-size:0.85rem;';
      typing.innerHTML = `<i class="fa-solid fa-robot fa-spin"></i> Thinking…`;
      chatLog.appendChild(typing);
      chatLog.scrollTop = chatLog.scrollHeight;

      try {
        const response = await (API.sendChatMessage 
          ? API.sendChatMessage(messagesToSend)
          : Promise.reject(new Error('Conversational AI not available')));

        // Remove typing
        typing.remove();

        // Add assistant response
        addMessageToHistory('assistant', response);

      } catch (err) {
        typing.remove();
        const errorBubble = document.createElement('div');
        errorBubble.style.cssText = 'align-self:flex-start; color:#f87171; font-size:0.85rem;';
        errorBubble.textContent = `Error: ${err.message || 'Something went wrong'}`;
        chatLog.appendChild(errorBubble);
      } finally {
        sendBtn.disabled = false;
        textarea.focus();
      }
    }

    // Send on button click or Enter (Shift+Enter for newline)
    sendBtn.onclick = sendMessage;

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // New Chat
    if (newChatBtn) {
      newChatBtn.onclick = () => {
        conversationHistory = [];
        chatLog.innerHTML = '';
        textarea.value = '';
        textarea.focus();
      };
    }

    // Optional: allow opening the widget programmatically (also gated via shared lead gate)
    window.FlopSource = window.FlopSource || {};
    window.FlopSource.openAIConsultation = () => {
      const gate = getLeadGate();
      if (gate && typeof gate.requireThen === 'function') {
        gate.requireThen(() => showPanel());
      } else {
        showPanel();
      }
    };

    // Auto-focus the input when the panel becomes visible + optional welcome message
    const originalShow = showPanel;
    showPanel = function() {
      originalShow();
      setTimeout(() => {
        if (textarea) textarea.focus();

        // Show a friendly welcome the first time the chat is used in this session
        if (conversationHistory.length === 0 && chatLog.children.length === 0) {
          const welcome = document.createElement('div');
          welcome.style.cssText = 'align-self:flex-start; background:var(--bg-surface); border:1px solid var(--border-md); padding:10px 14px; border-radius:14px; border-bottom-left-radius:4px; max-width:85%;';
          welcome.textContent = "Hi! Tell me about your project or workload. I'll ask a few questions so I can give you a really good recommendation.";
          chatLog.appendChild(welcome);
        }
      }, 80);
    };
  }

  // Expose
  window.FlopSourceAI = window.FlopSourceAI || {
    init: initFloatingAIConsultationWidget
  };

})();