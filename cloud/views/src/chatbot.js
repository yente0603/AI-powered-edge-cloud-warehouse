// src/chatbot.js
import CONSTANTS from './constants.js';
import * as api from './api.js';
import * as uiRenderer from './uiRenderer.js';
import * as utils from './utils.js';

let isSending = false;

async function sendMessage() {
    if (isSending) return;

    const chatInput = utils.getElement(CONSTANTS.ELEMENT_IDS.CHAT_INPUT);
    if (!chatInput) return;

    const userMessage = chatInput.value.trim();
    if (!userMessage) return;

    isSending = true;
    uiRenderer.addChatMessage('你', userMessage, 'user');
    uiRenderer.clearChatInput();
    uiRenderer.toggleChatInput(true);

    const thinkingMessage = uiRenderer.addChatMessage('倉儲Agent', '正在思考中...', 'agent');

    try {
        const data = await api.sendChatMessage(userMessage);
        if (thinkingMessage && thinkingMessage.parentNode) {
            thinkingMessage.remove();
        }
        const agentResponse = data?.response || data?.completion || "抱歉，我目前無法處理您的請求。";
        uiRenderer.addChatMessage('倉儲Agent', agentResponse, 'agent');
    }
    catch (error) {
        if (thinkingMessage && thinkingMessage.parentNode) {
            thinkingMessage.remove();
        }
        console.error('Chatbot 錯誤:', error);
        uiRenderer.addChatMessage('系統', `與助理溝通時發生錯誤: ${error.message}`, 'system');
    }
    finally {
        isSending = false;
        uiRenderer.toggleChatInput(false);
    }
}

// --- Chatbot Init --- //
export function init() {
    const chatInput = utils.getElement(CONSTANTS.ELEMENT_IDS.CHAT_INPUT);
    const sendButton = utils.getElement(CONSTANTS.ELEMENT_IDS.SEND_BUTTON);

    if (!chatInput || !sendButton) {
        console.error("Chatbot 初始化失敗：缺少輸入框或發送按鈕。");
        return;
    }

    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    uiRenderer.addChatMessage('倉儲Agent', '你好！請問有什麼可以幫您的嗎？ (例如：目前庫存總量有多少？)', 'agent');
}