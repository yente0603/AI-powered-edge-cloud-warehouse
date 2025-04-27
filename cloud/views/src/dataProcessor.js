// src/dataProcessor.js
import CONSTANTS from './constants.js';
import config from './config.js';

export function transformRawItems(rawItems) {
    if (!Array.isArray(rawItems)) {
         console.warn("原始項目數據不是陣列:", rawItems);
         return [];
    }
    return rawItems.filter(item => item !== null && typeof item === 'object');
}

export function calculateFinalInStock(items) {
    const sortedItems = [...items].sort((a, b) => {
        const timeA = a[CONSTANTS.KEYS.INBOUND_TIME];
        const timeB = b[CONSTANTS.KEYS.INBOUND_TIME];
        try {
            const dateA = timeA ? new Date(timeA).getTime() : 0;
            const dateB = timeB ? new Date(timeB).getTime() : 0;
            if (isNaN(dateA)) return -1;
            if (isNaN(dateB)) return 1;
            return dateA - dateB;
        }
        catch (e) {
            console.warn("時間排序比較時發生錯誤", e);
            return 0;
        }
    });

    const locationStateMap = new Map();
    sortedItems.forEach(item => {
        const location = item[CONSTANTS.KEYS.SHELF_LOCATION];
        const isIssued = item[CONSTANTS.KEYS.IS_ISSUED] === true;

         if (location && typeof location === 'string' && location.trim() !== "" && location !== "無") {
            if (!isIssued) {
                locationStateMap.set(location, item);
            } else {
                if (locationStateMap.has(location)) {
                    locationStateMap.delete(location);
                }
            }
        }
    });

    return Array.from(locationStateMap.values());
}

export function prepareCategoryRatioData(inStockItems) {
    const categoryCounts = {};
    inStockItems.forEach(item => {
        const itemType = item[CONSTANTS.KEYS.ITEM_TYPE] || "未知類型";
        categoryCounts[itemType] = (categoryCounts[itemType] || 0) + 1;
    });

    const labels = Object.keys(categoryCounts);
    const data = Object.values(categoryCounts);
    const backgroundColors = labels.map((_, index) =>
        config.chartColors.categorical[index % config.chartColors.categorical.length]
    );

    return {
        labels,
        datasets: [{
            label: 'Inventory Count',
            data,
            backgroundColor: backgroundColors,
            hoverOffset: 4
        }]
    };
}

export function prepareShelfStatusData(inStockItems) {
    const shelfCounts = { A: 0, B: 0, C: 0, D: 0 };
    inStockItems.forEach(item => {
        const location = item[CONSTANTS.KEYS.SHELF_LOCATION];
        if (location && typeof location === 'string' && location.length > 0) {
            const shelf = location.charAt(0).toUpperCase();
            if (shelfCounts.hasOwnProperty(shelf)) {
                shelfCounts[shelf]++;
            }
        }
    });

    const labels = Object.keys(shelfCounts);
    const data = Object.values(shelfCounts);
    const backgroundColors = labels.map((_, index) =>
        config.chartColors.categorical[index % config.chartColors.categorical.length]
    );

    return {
        labels,
        datasets: [{
            label: 'Inventory Count',
            data,
            backgroundColor: backgroundColors
        }]
    };
}

export function prepareInventoryTrendData(allItems) {
    const dailyCounts = {};
    const allDates = new Set();

    allItems.forEach(item => {
        const timestamp = item[CONSTANTS.KEYS.INBOUND_TIME];
        const isIssued = item[CONSTANTS.KEYS.IS_ISSUED] === true;

        if (timestamp) {
            try {
                const date = new Date(timestamp);
                if (!isNaN(date.getTime())) {
                    const dateStr = date.toISOString().split('T')[0];
                    allDates.add(dateStr);
                    if (!dailyCounts[dateStr]) {
                        dailyCounts[dateStr] = { inbound: 0 /* , outbound: 0 */ };
                    }
                    if (!isIssued) {
                        dailyCounts[dateStr].inbound++;
                    }
                    // else {
                    //     dailyCounts[dateStr].outbound++;
                    // }
                }
            }
            catch (e) { }
        }
    });

    const sortedDates = Array.from(allDates).sort();
    const labels = sortedDates;
    const inboundData = [];
    // const outboundData = [];
    // const cumulativeInventoryData = [];
    // let currentTotalInventory = 0;

    sortedDates.forEach(date => {
        const dailyIn = dailyCounts[date]?.inbound || 0;
        // const dailyOut = dailyCounts[date]?.outbound || 0;
        inboundData.push(dailyIn);
        // outboundData.push(dailyOut);
        // currentTotalInventory += (dailyIn - dailyOut);
        // cumulativeInventoryData.push(currentTotalInventory);
    });

    return {
        labels,
        datasets: [
            {
                label: 'Daily Inbound',
                data: inboundData,
                borderColor: config.chartColors.line.inbound,
                backgroundColor: config.chartColors.line.inbound + '20', // Light fill color
                fill: false, // Or true if area fill is desired
                tension: 0.1, // Slight curve to the line
                borderWidth: 2
            }
            // { label: '當日出庫', data: outboundData, borderColor: config.chartColors.line.outbound, backgroundColor: config.chartColors.line.outbound + '20', fill: false, tension: 0.1 },
            // { label: '累積庫存', data: cumulativeInventoryData, borderColor: config.chartColors.line.currentInventory, backgroundColor: config.chartColors.line.currentInventory + '20', fill: false, tension: 0.1 }
        ]
    };
}