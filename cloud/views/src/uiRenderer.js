// src/uiRenderer.js
import CONSTANTS from './constants.js';
import config from './config.js';
import state from './state.js';
import * as utils from './utils.js';

function _renderChart(chartId, currentChartInstance, chartType, chartData, chartOptions) {
    const canvas = utils.getElement(chartId);
    if (!canvas) {
        console.error(`找不到 Canvas 元素: ${chartId}`);
        return null;
    }
    const ctx = canvas.getContext('2d');

    utils.destroyChart(currentChartInstance);

    try {
        return new Chart(ctx, { type: chartType, data: chartData, options: chartOptions });
    }
    catch (e) {
         console.error(`創建圖表 ${chartId} 時發生錯誤:`, e);
         return null;
    }
}

// --- 渲染貨架模擬圖 ---
export function renderShelfSimulation(inStockItems) {
    const simulationContainer = utils.getElement('twinmaker-simulation');
    if (!simulationContainer) {
        console.error("找不到貨架模擬圖容器元素：#twinmaker-simulation");
        return;
    }

    const locationElements = simulationContainer.querySelectorAll('.position[data-location]');
    if (!locationElements || locationElements.length === 0) {
        console.warn("在 #twinmaker-simulation 中找不到任何 .position 元素。");
        return;
    }

    locationElements.forEach(el => el.classList.remove('occupied'));

    const occupiedLocations = new Set(
        inStockItems
            .map(item => item[CONSTANTS.KEYS.SHELF_LOCATION])
            .filter(loc => loc && typeof loc === 'string' && loc.trim() !== "")
    );
    console.debug("[Debug] Occupied Locations:", occupiedLocations);

    occupiedLocations.forEach(locationId => {
        const element = simulationContainer.querySelector(`.position[data-location="${locationId}"]`);
        if (element) {
            element.classList.add('occupied');
        }
        else {
            console.warn(`[Warn] 在模擬圖中找不到儲位元素： ${locationId}`);
        }
    });
}

// --- 貨物種類比例 --- //
export function renderCategoryRatioChart(data) {
    const options = {
        responsive: true, maintainAspectRatio: false, layout: { padding: 10 },
        plugins: {
            legend: { position: 'top' },
            title: { display: true, text: '在庫商品種類比例' }
        }
    };
    state.chartInstances.categoryRatio = _renderChart(
        CONSTANTS.CHART_IDS.CATEGORY_RATIO,
        state.chartInstances.categoryRatio,
        'pie', data, options
    );
}

// --- 貨架狀態 --- //
export function renderShelfStatusChart(data) {
    const options = {
        responsive: true, maintainAspectRatio: false, layout: { padding: 10 },
        plugins: {
            legend: { display: false },
            title: { display: true, text: '各貨架在庫數量' }
        },
        scales: {
            y: { beginAtZero: true, title: { display: true, text: '數量' }, ticks: { callback: v => Number.isInteger(v) ? v : null, stepSize: 1 } },
            x: { title: { display: true, text: '貨架' } }
        }
    };
     state.chartInstances.shelfStatus = _renderChart(
        CONSTANTS.CHART_IDS.SHELF_STATUS,
        state.chartInstances.shelfStatus,
        'bar', data, options
    );
}

// --- 入庫趨勢 --- //
export function renderInventoryTrendChart(data) {
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: 10 },
        plugins: {
            legend: {
                display: false,
                // position: 'top',
                // labels: {usePointStyle: true, pointStyle: 'line', boxWidth: 50, padding: 20,}
            },
            // title: { display: true, text: '每日庫存趨勢' }
        },
        scales: {
            y: { beginAtZero: true, title: { display: true, text: '數量' }, ticks: { callback: v => Number.isInteger(v) ? v : null, stepSize: 1 } },
            x: { title: { display: true, text: '日期' } }
        }
    };
     state.chartInstances.inventoryTrend = _renderChart(
        CONSTANTS.CHART_IDS.INVENTORY_TREND,
        state.chartInstances.inventoryTrend,
        'line', data, options
    );
}

export function renderInventoryTable(inStockItems) {
    const tableHead = utils.getElement(CONSTANTS.ELEMENT_IDS.INVENTORY_TABLE_HEAD);
    const tableBody = utils.getElement(CONSTANTS.ELEMENT_IDS.INVENTORY_TABLE_BODY);
    const errorContainer = utils.getElement(CONSTANTS.ELEMENT_IDS.INVENTORY_ERROR);

    if (!tableHead || !tableBody) {
        console.error("無法渲染表格：缺少 thead 或 tbody 元素。");
        return;
    }
    if (errorContainer) errorContainer.style.display = 'none';

    tableHead.innerHTML = '';
    tableBody.innerHTML = '';

    // --- *** 修改排序邏輯 *** ---
    const sortedItems = [...inStockItems].sort((a, b) => {
        const timeA = a[CONSTANTS.KEYS.INBOUND_TIME];
        const timeB = b[CONSTANTS.KEYS.INBOUND_TIME];
        try {
            const dateA = timeA ? new Date(timeA).getTime() : 0;
            const dateB = timeB ? new Date(timeB).getTime() : 0;

            if (isNaN(dateA)) return 1;
            if (isNaN(dateB)) return -1;

            return dateB - dateA;
        } catch (e) {
            console.warn("表格時間排序比較時發生錯誤", e);
            return (timeB || "").localeCompare(timeA || "");
        }
    });

    const headerRow = tableHead.insertRow();
    config.displayedColumns.forEach(key => {
        const th = document.createElement('th');
        th.textContent = key;
        th.scope = "col";
        th.style.width = config.columnWidths[key] || 'auto';
        headerRow.appendChild(th);
    });

    if (inStockItems.length === 0) {
        const colspan = config.displayedColumns.length || CONSTANTS.DEFAULT_COLSPAN;
        tableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-center muted">目前無商品在庫</td></tr>`;
        return;
    }

    if (sortedItems.length === 0) {
        return;
    }

    sortedItems.forEach(item => {
        const row = tableBody.insertRow();
        const isViolation = item[CONSTANTS.KEYS.IS_VIOLATION] === true;
        if (isViolation) row.classList.add('violation-row');

        config.displayedColumns.forEach(key => {
            const cell = row.insertCell();
            let cellContent = item[key] ?? "";

            if (key === CONSTANTS.KEYS.INBOUND_TIME) {
                cellContent = utils.formatTimestamp(cellContent);
            } else if (key === CONSTANTS.KEYS.IS_VIOLATION) {
                cellContent = cellContent === true ? "是" : "否";
            } else if (key === CONSTANTS.KEYS.VIOLATION_CONTENT) {
                cellContent = isViolation ? cellContent : "";
            }
            cell.textContent = String(cellContent);
        });
    });
}

// --- 處理錯誤訊息 ---//
export function showError(message) {
    const errorContainer = utils.getElement(CONSTANTS.ELEMENT_IDS.INVENTORY_ERROR);
    const tableHead = utils.getElement(CONSTANTS.ELEMENT_IDS.INVENTORY_TABLE_HEAD);
    const tableBody = utils.getElement(CONSTANTS.ELEMENT_IDS.INVENTORY_TABLE_BODY);

    if (errorContainer) {
        errorContainer.textContent = `錯誤: ${message}`;
        errorContainer.style.display = 'block';
    }
    if (tableHead) tableHead.innerHTML = '';
    if (tableBody) tableBody.innerHTML = '';

    state.chartInstances.shelfStatus = utils.destroyChart(state.chartInstances.shelfStatus);
    state.chartInstances.categoryRatio = utils.destroyChart(state.chartInstances.categoryRatio);
    state.chartInstances.inventoryTrend = utils.destroyChart(state.chartInstances.inventoryTrend);
    console.error(message);
}

// --- Chatbot UI ---
export function addChatMessage(sender, message, type = 'agent') {
    const chatHistory = utils.getElement(CONSTANTS.ELEMENT_IDS.CHAT_HISTORY);
    if (!chatHistory) return null;

    const p = document.createElement('p');
    p.classList.add(`${type}-message`);

    let prefix = "";
    switch(type) {
        case 'user': prefix = "你:"; break;
        case 'agent': prefix = "倉儲Agent:"; break;
        case 'system': prefix = "系統:"; break;
    }

    // 創建標題部分
    const strong = document.createElement('strong');
    strong.textContent = prefix + " ";
    p.appendChild(strong);

    // 處理訊息文本
    if (message && typeof message === 'string') {
        const escapeHtml = (unsafe) => {
            return unsafe
                .replace(/&/g, "&")
                .replace(/</g, "<")
                .replace(/>/g, ">")
                .replace(/"/g, "‘")
                .replace(/'/g, "'");
        }

        const formattedMessage = escapeHtml(message).replace(/\n/g, '<br>');
        const messageSpan = document.createElement('span');
        messageSpan.innerHTML = formattedMessage;
        p.appendChild(messageSpan);

    }
    else {
        p.appendChild(document.createTextNode(String(message)));
    }

    chatHistory.appendChild(p);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return p;
}

export function clearChatInput() {
    const chatInput = utils.getElement(CONSTANTS.ELEMENT_IDS.CHAT_INPUT);
    if (chatInput) chatInput.value = '';
}

export function toggleChatInput(disabled) {
    const chatInput = utils.getElement(CONSTANTS.ELEMENT_IDS.CHAT_INPUT);
    const sendButton = utils.getElement(CONSTANTS.ELEMENT_IDS.SEND_BUTTON);
    if (chatInput) chatInput.disabled = disabled;
    if (sendButton) sendButton.disabled = disabled;
    if (!disabled && chatInput) chatInput.focus();
}