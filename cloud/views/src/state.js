// src/state.js
const state = {
    chartInstances: {
        shelfStatus: null,
        inventoryTrend: null,
        categoryRatio: null
    },
    lastRenderedInStockItems: null,     // 儲存上一次成功渲染的在庫商品列表
    lastRenderedStandardItems: null,    // 儲存上一次成功處理的圖表
};

export default state;