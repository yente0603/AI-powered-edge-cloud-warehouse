// src/api.js
import config from './config.js';

async function _fetchJson(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            let errorMsg = `HTTP ERROR, Status: ${response.status}`;
            let responseText = '';
            try {
                 responseText = await response.text();
                 const errJson = JSON.parse(responseText);
                 errorMsg = errJson.message || errJson.error || responseText || errorMsg;
            }
            catch (e) {
                 errorMsg = responseText || errorMsg;
            }
            if (response.status === 504 || response.status === 503) {
                errorMsg += " (請求可能超時)";
            }
            throw new Error(errorMsg);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    }
    catch (error) {
        console.error(`Fetch 錯誤 (${url}):`, error);
        throw error;
    }
}

async function _postJson(url, data) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            let errorMsg = `HTTP ERROR, Status: ${response.status}`;
            let responseText = '';
            try {
                responseText = await response.text();
                const errJson = JSON.parse(responseText);
                errorMsg = errJson.message || errJson.error?.message || (typeof errJson === 'string' ? errJson : null) || responseText || errorMsg;
            }
            catch (e) {
                errorMsg = responseText || errorMsg;
            }
            if (response.status === 504 || response.status === 503) {
                errorMsg += " (請求可能超時)";
            }
            throw new Error(errorMsg);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    }
    catch (error) {
        console.error(`POST 錯誤 (${url}):`, error);
        throw error;
    }
}

export function getItems() {
    return _fetchJson(`${config.apiBaseUrl}/items`);
}

export function sendChatMessage(query) {
    return _postJson(`${config.apiBaseUrl}/chat`, { query });
}
