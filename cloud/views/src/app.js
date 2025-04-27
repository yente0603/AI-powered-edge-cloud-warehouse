// src/app.js
import CONSTANTS from './constants.js';
import * as api from './api.js';
import * as dataProcessor from './dataProcessor.js';
import * as uiRenderer from './uiRenderer.js';
import * as chatbot from './chatbot.js';
import state from './state.js';

const app = {
    refreshIntervalId: null,

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            console.info("[Info] DOM Ready, initializing application...");
            chatbot.init();             // Initialize Chatbot functionality
            this.loadInventoryData();   // Perform initial data load and render
            this.startAutoRefresh();    // Start periodic data refresh
        });
    },

    _haveArraysChanged(newArray, oldArray, sortKey) {
        if (newArray === null && oldArray === null) return false;
        if (newArray === null || oldArray === null) return true;
        if (newArray.length !== oldArray.length) return true;
        if (newArray.length === 0 && oldArray.length === 0) return false;

        const sortFn = (a, b) => (String(a[sortKey] ?? '')).localeCompare(String(b[sortKey] ?? ''));
        try {
            if (!Array.isArray(newArray) || !Array.isArray(oldArray)) {
                console.warn("比較陣列時發現非陣列參數");
                return true;
            }
            const sortedNew = [...newArray].sort(sortFn);
            const sortedOld = [...oldArray].sort(sortFn);
            return JSON.stringify(sortedNew) !== JSON.stringify(sortedOld);
        }
        catch (e) {
            console.error(`[Error] 比較陣列 (key: ${sortKey}) 時發生序列化或排序錯誤:`, e);
            return true;
        }
    },

    async loadInventoryData() {
        let inStockDataChanged = false;
        let trendDataChanged = false;

        try {
            const rawItems = await api.getItems();
            const standardItems = dataProcessor.transformRawItems(rawItems);
            console.debug("[Debug] API Data Processed:", standardItems);

            // --- 比較趨勢數據 (standardItems) ---
            const trendSortKey = 'itemid';
            if (this._haveArraysChanged(standardItems, state.lastRenderedStandardItems, trendSortKey)) {
                console.info("[Info] Trend data (standardItems) has changed.");
                trendDataChanged = true;
                state.lastRenderedStandardItems = JSON.parse(JSON.stringify(standardItems));
            } else {
                console.log("[Info] No changes in trend data (standardItems), skipping trend chart render.");
            }

            // --- 計算並比較在庫數據 (finalInStockItems) ---
            // Calculate current in-stock items based on the latest standardItems
            const newFinalInStockItems = (standardItems.length > 0)
                ? dataProcessor.calculateFinalInStock(standardItems)
                : [];
            console.debug("[Debug] Calculated In-Stock Items:", newFinalInStockItems);

            // 使用貨架位置作為比較在庫商品的排序鍵
            const inStockSortKey = CONSTANTS.KEYS.SHELF_LOCATION;
            if (this._haveArraysChanged(newFinalInStockItems, state.lastRenderedInStockItems, inStockSortKey)) {
                console.info("[Info] In-stock item data (finalInStockItems) has changed.");
                inStockDataChanged = true;
                state.lastRenderedInStockItems = JSON.parse(JSON.stringify(newFinalInStockItems));
            } else {
                console.log("[Info] No changes in in-stock data (finalInStockItems), skipping table, related charts, and simulation render.");
            }


            // ---  數據變更時重新渲染圖表＆貨架 ---
            if (inStockDataChanged) {
                console.log("[Info] Rendering table, shelf status chart, category ratio chart, and shelf simulation.");
                uiRenderer.renderInventoryTable(newFinalInStockItems);

                const categoryData = dataProcessor.prepareCategoryRatioData(newFinalInStockItems);
                const shelfData = dataProcessor.prepareShelfStatusData(newFinalInStockItems);
                uiRenderer.renderCategoryRatioChart(categoryData);
                uiRenderer.renderShelfStatusChart(shelfData);

                // --- 呼叫渲染貨架模擬圖的函數 ---
                uiRenderer.renderShelfSimulation(newFinalInStockItems);
                console.info("[Info] Shelf simulation rendered.");
            }

            // --- 數據變更時重新渲染入庫趨勢圖 ---
            if (trendDataChanged) {
                console.log("[Info] Rendering inventory trend chart.");
                const trendData = dataProcessor.prepareInventoryTrendData(standardItems);
                uiRenderer.renderInventoryTrendChart(trendData);
            }

            // --- 處理錯誤訊息的顯示 ---
            const errorContainer = document.getElementById(CONSTANTS.ELEMENT_IDS.INVENTORY_ERROR);
            if (errorContainer && errorContainer.style.display !== 'none') {
                console.info("[Info] Hiding previous error message.");
                errorContainer.style.display = 'none';
                errorContainer.textContent = '';
            }

        }
        catch (error) {
            console.error("[Error] Failed to load or process inventory data:", error);
            uiRenderer.showError(`Failed to load inventory data: ${error.message}`);

            state.lastRenderedInStockItems = null;
            state.lastRenderedStandardItems = null;
        }
    },

    startAutoRefresh() {
        this.stopAutoRefresh(); // Ensure no duplicate timers
        console.log(`[Info] Starting auto-refresh every ${CONSTANTS.REFRESH_INTERVAL_MS / 1000} seconds.`);
        this.refreshIntervalId = setInterval(() => {
            console.log("[Info] Auto-refresh triggered...");
            this.loadInventoryData();
        }, CONSTANTS.REFRESH_INTERVAL_MS);
    },

    stopAutoRefresh() {
        if (this.refreshIntervalId) {
            clearInterval(this.refreshIntervalId);
            this.refreshIntervalId = null;
            console.log("[Info] Auto-refresh stopped.");
        }
    }
};

// Initialize the application
app.init();