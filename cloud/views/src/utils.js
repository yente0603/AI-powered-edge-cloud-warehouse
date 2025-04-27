// src/utils.js

export function destroyChart(chartInstance) {
    if (chartInstance) {
        try {
            chartInstance.destroy();
        }
        catch (e) {
            console.error("銷毀圖表時發生錯誤:", e);
        }
    }
    return null;
}

// JSON與DynamoDB格式轉換
export function transformDynamoDbItem(dynamoItem) {
    if (!dynamoItem || typeof dynamoItem !== 'object') {
        console.warn("嘗試轉換無效的 DynamoDB 項目:", dynamoItem);
        return null;
    }
    const standardItem = {};
    for (const key in dynamoItem) {
        const valueObject = dynamoItem[key];
        if (valueObject && typeof valueObject === 'object' && Object.keys(valueObject).length === 1) {
            const dataType = Object.keys(valueObject)[0];
            const value = valueObject[dataType];

            switch (dataType) {
                case 'S': standardItem[key] = value; break;
                case 'N': standardItem[key] = Number(value); break;
                case 'BOOL': standardItem[key] = value; break;
                case 'NULL': standardItem[key] = null; break;
                case 'L':
                    standardItem[key] = Array.isArray(value)
                        ? value.map(element => transformDynamoDbItem({ 'temp': element }).temp)
                        : [];
                    break;
                case 'M':
                    standardItem[key] = transformDynamoDbItem(value);
                    break;
                default:
                    console.warn(`不支援的 DynamoDB 資料類型 "${dataType}" (鍵: "${key}")。`);
                    standardItem[key] = valueObject;
            }
        }
        else {
             console.warn(`鍵 "${key}" 的值格式不符合預期的 DynamoDB 類型結構:`, valueObject);
             standardItem[key] = valueObject;
        }
    }
    return standardItem;
}

// 時間排序
export function formatTimestamp(timestampStr) {
    if (!timestampStr) return "";
    try {
        const date = new Date(timestampStr);
        if (isNaN(date.getTime())) {
            console.warn(`無法解析的日期字串: "${timestampStr}"`);
            return timestampStr;
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    catch (e) {
        console.warn(`格式化日期時間 "${timestampStr}" 時出錯:`, e);
        return timestampStr;
    }
}

export function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`錯誤：找不到 ID 為 '${id}' 的元素。`);
    }
    return element;
}