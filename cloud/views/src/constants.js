// src/constants.js
const CONSTANTS = {
    KEYS: {
        INBOUND_USER: "入庫員工",
        INBOUND_TIME: "入庫時間",
        SHELF_LOCATION: "貨架位置",
        ITEM_TYPE: "物品類型",
        IS_ISSUED: "是否出庫",
        IS_VIOLATION: "是否違規",
        VIOLATION_CONTENT: "違規內容"
    },
    CHART_IDS: {
        SHELF_STATUS: 'shelfStatusChart',
        CATEGORY_RATIO: 'categoryRatioChart',
        INVENTORY_TREND: 'inventoryTrendChart'
    },
    ELEMENT_IDS: {
        INVENTORY_TABLE: 'inventory-details',
        INVENTORY_TABLE_BODY: 'inventory-details-tbody',
        INVENTORY_TABLE_HEAD: 'inventory-details-thead',
        INVENTORY_ERROR: 'inventory-error',
        CHAT_INPUT: 'chat-input',
        SEND_BUTTON: 'send-button',
        CHAT_HISTORY: 'chat-history',
        TWINMAKER_EMBED: 'twinmaker-embed',
    },
    DEFAULT_COLSPAN: 7,
    REFRESH_INTERVAL_MS: 1000,
};

export default CONSTANTS;