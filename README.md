# AI-powered-edge-cloud-warehouse

整合 ICAM-540 (基於 Jetson 平台) 的邊緣計算能力與 AWS 雲端服務，為智慧倉儲場景打造一個涵蓋物件偵測、事件觸發、資料分析與前端監控的端到端解決方案。

## 專案概覽

本專案結合邊緣計算與雲端服務的優勢，核心流程如下：

*   **邊緣端 (ICAM-540 + Jetson):**
    *   從攝影機獲取影像。
    *   執行輕量級 AI 模型 (ssd-mobilenet-v2) 進行即時物件偵測與分析。
    *   根據業務規則判斷並觸發特定事件 (如異常偵測)。
    *   捕獲事件相關影像/短片並異步上傳至 **AWS S3**。
    *   透過 **AWS IoT Core (MQTT)** 安全地發送包含 S3 路徑等元數據的事件通知至雲端。
    *   將即時視訊流推送到 **AWS Kinesis Video Streams (KVS)**。
    *   接收並處理來自雲端的控制命令。

*   **雲端服務 (AWS Cloud):**
    *   **數據接收 (Ingest):** 利用 **AWS IoT Core** 接收邊緣事件，**KVS** 接收視訊流。
    *   **事件處理與分析 (Processing & Insights):**
        *   **AWS IoT Events** 根據 IoT Core 事件觸發後續流程。
        *   **AWS Lambda** 處理事件邏輯，協調服務。
        *   從 S3 讀取媒體，利用 **Amazon Rekognition** 進行影像分析。
        *   利用 **AWS Bedrock** 進行更深度情境理解、報告生成。
    *   **數據儲存 (Storage):** 分析結果和事件記錄存儲於 **Amazon DynamoDB**，原始媒體存儲於 **S3**。
    *   **數位鑾身 (Digital Twin):** **AWS IoT TwinMaker** 整合 KVS/DynamoDB 數據，建立可視化倉儲數位模型。
    *   **使用者介面與互動 (Frontend & API):**
        *   使用者透過 **CloudFront** 託管的前端介面訪問系統。
        *   **API Gateway** 提供後端 API 供前端或第三方調用。
        *   前端介面內嵌 **AI 聊天機器人 (基於 AWS Bedrock Agent)**，使用者可自然語言查詢 **DynamoDB** 中的即時數據或相關守則。


## 核心組成與工作流程

### 邊緣計算層 (Edge Computing)

*   **裝置：** ICAM-540 (基於 Jetson 平台)。
*   **AI 推理：** 運行輕量級物件偵測模型 (例如：ssd-mobilenet-v2)，對來自攝影機的影像進行即時分析。
*   **事件判斷：** 根據 AI 分析結果與預設業務規則判斷是否發生特定事件。
*   **資料捕獲：** 在事件發生時，捕獲相關的靜態影像或動態短片。
*   **雲端通訊：**
    *   將捕獲的影像/短片異步上傳至 AWS S3。
    *   透過 **AWS IoT Core (MQTT)** 安全地發送事件元數據和狀態更新至雲端。
*   **命令接收：** 接收並執行來自雲端後台的控制命令 (如遠端配置更新、手動影像請求)。
*   **視訊串流 (可選)：** 將即時視訊流推送到 **AWS Kinesis Video Streams (KVS)**。

### 雲端服務層 (AWS Cloud Service)

雲端層負責接收邊緣數據、執行深度分析、資料儲存、建立數位鑾身以及提供使用者介面。

*   **資料接收 (Ingest)：**
    *   **AWS IoT Core：** 接收邊緣裝置發送的 MQTT 消息 (事件通知、狀態更新)。
    *   **AWS Kinesis Video Streams (KVS)：** 接收邊緣裝置的即時視訊串流。
*   **事件處理與分析 (Insights & Processing)：**
    *   **AWS IoT Events：** 根據 IoT Core 接收到的事件觸發相應的動作。
    *   **AWS Lambda：** 無伺服器函數，由 IoT Events 或 API Gateway 觸發，負責處理事件邏輯、協調其他服務。例如：
        *   處理邊緣事件通知，從 S3 獲取影像。
        *   調用 **Amazon Rekognition** 進行影像/視訊內容分析。
        *   調用 **AWS Bedrock** 進行更複雜的情境理解、異常分析或報告生成。
        *   更新 **Amazon DynamoDB** 中的事件和分析結果。
    *   **Amazon Rekognition：** 提供預先訓練的電腦視覺功能，用於影像標籤、物件偵測、名人識別等。
    *   **AWS Bedrock：** 提供基礎模型 (FMs) 的存取，用於生成式 AI 和大型語言模型的應用，在本專案中可用於對事件進行高階分析、生成自然語言報告或摘要。
*   **資料儲存 (Storage)：**
    *   **Amazon S3：** 高度可擴展的物件儲存服務，用於儲存從邊緣裝置上傳的原始影像和短片。
    *   **Amazon DynamoDB：** 高效能的 NoSQL 資料庫，用於儲存結構化數據，如事件記錄、分析結果、裝置狀態等。
*   **數位孿生 (Digital Twin)：**
    *   **AWS IoT TwinMaker：** 用於輕鬆建立建築物、工廠和工業設備的數位鑾身，可整合來自 KVS 和 DynamoDB 的數據，提供倉儲環境的虛擬視圖和上下文。
*   **API 與使用者介面 (API Management & Frontend)：**
    *   **Amazon CloudFront：** 內容傳遞網路 (CDN)，用於分發前端靜態資源，並可作為使用者訪問 API Gateway 和 S3 資源的入口。
    *   **Amazon API Gateway：** 建立、發布、維護和監控 RESTful API，作為使用者介面與後端 Lambda 函數、IoT TwinMaker 互動的橋樑。
*   **使用者 (User)：** 通過 CloudFront 訪問前端介面，並通過 API Gateway 與後端服務互動，進行監控、查詢和控制操作。

## 系統架構
以下架構圖展示了本專案中邊緣計算與 AWS 雲端服務之間的關鍵組件及其互動流程：
![image](aws.drawio.png)

**架構圖說明：**

1.  **Edge 端 (ICAM-540 + ssd-mobilenet-v2)：** 負責影像擷取、邊緣 AI 推理 (物件偵測)。
2.  **Edge-Cloud MQTT protocol：** 邊緣端透過 MQTT 協議與 **AWS IoT Core** 進行雙向通訊，發送事件元數據、狀態更新，並接收控制命令。
3.  **ICAM-540 -> KVS：** ICAM-540 也可將即時視訊流推送到 **AWS Kinesis Video Streams (KVS)** 進行視訊儲存和進一步處理。
4.  **Edge -> S3：** 邊緣端直接將事件相關的影像/短片檔案上傳到 **Amazon S3**。
5.  **AWS Cloud - Ingest：** **AWS IoT Core** 和 **KVS** 作為雲端數據的入口。
6.  **AWS IoT Core -> AWS IoT Events -> Lambda：** IoT Core 接收到邊緣事件消息後，可觸發 **AWS IoT Events** 狀態機，進而調用 **AWS Lambda** 函數進行事件處理。
7.  **Lambda -> S3, DynamoDB, Rekognition, Bedrock：** Lambda 函數是後端邏輯的協調者，可以從 S3 讀取影像、將處理結果寫入 DynamoDB、調用 Amazon Rekognition 和 AWS Bedrock 進行分析。
8.  **KVS -> AWS IoT TwinMaker：** KVS 的視訊流數據可以整合到 **AWS IoT TwinMaker** 中，用於建立數位鑾身並提供即時監控視圖。
9.  **AWS IoT TwinMaker -> DynamoDB：** 數位鑾身的狀態或相關數據可以儲存或參考自 DynamoDB。
10. **Storage (S3, DynamoDB)：** S3 儲存原始媒體文件，DynamoDB 儲存結構化數據。兩者均可被 Lambda 或其他服務存取。
11. **API Management (API Gateway, CloudFront)：**
    *   **CloudFront：** 提供前端內容分發和使用者訪問入口。
    *   **API Gateway：** 暴露後端 API 給前端或第三方應用。
12. **User：** 使用者通過 CloudFront 和 API Gateway 訪問系統，與雲端服務互動，進行監控、查詢和控制。
13. **API Gateway -> Lambda, AWS IoT TwinMaker：** API Gateway 將使用者的請求路由到相應的後端服務 (Lambda 處理業務邏輯，IoT TwinMaker 提供數位鑾身互動)。
14. **CloudFront -> S3, API Gateway：** CloudFront 可以直接服務 S3 中的靜態資源 (如前端檔案或影像)，也可以將 API 請求轉發給 API Gateway。

此架構圖清晰地描繪了從邊緣裝置的數據採集、雲端的數據攝取、處理、分析、儲存到最終使用者互動的完整流程。
