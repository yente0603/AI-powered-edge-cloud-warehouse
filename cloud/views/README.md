# 智能倉儲監控儀表板 - 前端 (Intelligent Warehouse Monitoring Dashboard - Frontend)

## 專案概覽

本專案是「智能倉儲監控儀表板」的前端部分。它提供了一個網頁介面，用於視覺化倉儲的即時數據、顯示在庫商品詳情、模擬貨架使用情況，並允許使用者透過 AI 聊天機器人查詢相關資訊。前端透過 API 與後端服務（預期是 AWS API Gateway、Lambda、Bedrock Agent、DynamoDB 等）進行互動。

## 主要功能

*   **即時數據儀表板:**
    *   顯示各貨架目前在庫數量的柱狀圖。
    *   顯示目前在庫商品種類比例的圓餅圖。
    *   顯示每日入庫庫存變化的折線圖。
*   **在庫貨物詳情:**
    *   以表格形式展示當前所有在庫商品的詳細資訊（如入庫人、入庫時間、位置、類型、是否違規等）。
    *   表格內容根據入庫時間排序（最新優先）。
    *   標亮顯示違規的庫存項目。
*   **倉儲貨架模擬圖:**
    *   以靜態 2D 圖形模擬倉庫貨架佈局 (A, B, C, D 區)。
    *   根據 API 回傳的在庫商品數據，即時點亮（標示為佔用）對應的儲位。
*   **AI 倉儲助理:**
    *   提供聊天介面與後端的 AWS Bedrock Agent 互動。
    *   顯示對話歷史記錄，支援多行回應格式。
*   **動態刷新:**
    *   定時自動從後端獲取最新數據 (預設每秒)。
    *   僅在數據實際發生變化時更新對應的圖表、表格或模擬圖，提升使用者體驗與效能。
*   **響應式設計:** 介面能適應不同螢幕尺寸。

## 技術棧

*   HTML5
*   CSS3 (使用 CSS Variables, Flexbox, Grid)
*   JavaScript (ES6 Modules)
*   [Chart.js](https://www.chartjs.org/) v4+ - 用於繪製數據圖表。
*   (透過 `fetch` API 與後端 AWS API Gateway 互動)

## 專案結構

```
.
├── index.html
├── streaming.html
├── css/
│   ├── style.css          # 主要css
│   └── streaming.css      # 即時影像與3D視圖頁面css
└── src/
    ├── app.js             # 主應用程式入口，負責初始化和協調
    ├── api.js             # 處理所有 API 請求
    ├── chatbot.js         # Chatbot 相關邏輯
    ├── config.js          # 應用程式設定 (API URL, 顏色等)
    ├── constants.js       # 常數定義 (Keys, IDs)
    ├── dataProcessor.js   # 數據處理與計算邏輯
    ├── state.js           # 共用狀態管理 (例如圖表實例)
    ├── uiInteraction.js   # Sidebar相關設定
    ├── uiRenderer.js      # DOM 操作與渲染邏輯
    └── utils.js           # 通用輔助函式
```
## 組態設定

主要的組態設定位於 `src/config.js` 文件中：

*   `apiBaseUrl`: **必須**將此值設定為你已部署的 AWS API Gateway 的基礎 URL (例如 `https://<api-id>.execute-api.<region>.amazonaws.com/<stage>`)。前端的所有 API 請求都將基於此 URL。

其他的設定如圖表顏色 (`chartColors`)、表格顯示欄位 (`displayedColumns`)、欄位寬度 (`columnWidths`) 等也可以在此檔案中調整。

## 使用方式

打開 `index.html` 頁面後：

*   **查看儀表板:** 觀察自動加載的貨架狀態圖、種類比例圖、入庫趨勢圖以及下方的在庫貨物詳情表格。
*   **查看模擬圖:** 觀察左側的「倉儲貨架圖」，標示為橘色的儲位代表目前有商品在庫。
*   **與助理互動:** 在右側的「智能倉儲 Agent」區塊，於輸入框中輸入問題（例如「目前庫存總量有多少？」、「A區有多少庫存？」、「列出所有違規物品」），點擊「發送」按鈕或按 Enter 鍵，等待 AI 回應。
*   **自動刷新:** 頁面會預設每 1 秒自動向後端請求最新數據並更新儀表板內容（僅在數據變化時更新對應區塊）。
*   **切換頁面:** 點擊左上角的漢堡選單按鈕，可以展開側邊欄，切換至「串流/3D視圖」頁面查看 TwinMaker 和 KVS 的內容 (目前為靜態圖片/影片)。