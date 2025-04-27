# detectors/cargo_detector.py

import logging
import time
from typing import List, Dict, Optional, Any
import jetson.inference
import jetson.utils
import threading

from events.event_types import EventType
from events.event_manager import EventManager
from events.event_publisher import EventPublisher
from data_capture.capture_manager import CaptureManager, FrameData

from .base_detector import BaseDetector

from inference.inferencer import ObjectDetector

from utils import qr_scanner
from utils import image_utils
import cv2
import uuid
logger = logging.getLogger(__name__)

class CargoDetector(BaseDetector):
    """
    專注於偵測貨物和與貨物相關的事件，根據人員識別結果調整行為，並提取貨物信息。
    可以讀取最新的貨物處理結果（例如，分配的位置）用於顯示或進一步判斷。
    """
    def __init__(self, settings: dict,
                object_detector: ObjectDetector,
                event_manager: EventManager,
                event_publisher: EventPublisher,
                capture_manager: CaptureManager,
                recognition_result_state: Dict[str, Any], # <-- 人臉識別結果狀態
                cargo_result_state: Dict[str, Any], # <-- 新增：貨物處理結果狀態
                recognition_result_lock: threading.Lock): # <-- 保護共享狀態的鎖
        """
        初始化貨物偵測器。
        Args:
            settings (dict): 此偵測器的特定設定 (config.detectors.cargo)。
            object_detector (ObjectDetector): 主要物件偵測推論器實例。
            event_manager (EventManager): 事件管理器實例。
            event_publisher (EventPublisher): 事件發布器實例。
            capture_manager (CaptureManager): 捕獲管理器實例。
            recognition_result_state (Dict[str, Any]): 共享的最新雲端**人臉識別**結果字典。
            cargo_result_state (Dict[str, Any]): 共享的最新雲端**貨物處理**結果字典。
            recognition_result_lock (threading.Lock): 保護共享狀態的鎖。
        """
        # 父類只需要部分依賴，這裡傳遞所有需要的
        super().__init__(settings, object_detector, event_manager, event_publisher, capture_manager)

        self.cargo_class_names = self.settings.get('cargo_class_names')
        if not self.cargo_class_names:
            all_classes = list(object_detector.class_mapping.values())
            person_class = settings.get('detectors', {}).get('person', {}).get('class_name', 'person')
            self.cargo_class_names = [cls for cls in all_classes if cls != person_class]
            logger.info(f"CargoDetector 未指定具體貨物類別，將以下類別視為貨物: {self.cargo_class_names}")
            if not self.cargo_class_names:
                logger.warning("CargoDetector 找不到任何非人物的類別映射，將無法偵測貨物。請檢查 class_mapping 設定。")

        self.s3_cargo_checkin_folder = self.capture_manager.s3_settings.get('s3_cargo_checkin_folder')
        self.cooldown_seconds = self.settings.get('cooldown_seconds', 30)

        self.recognition_result_state = recognition_result_state # 人臉識別結果狀態
        self.cargo_result_state = cargo_result_state # 貨物處理結果狀態
        self.recognition_result_lock = recognition_result_lock

        self.allowed_person_ids = self.settings.get('allowed_person_ids', [])
        self.recognition_result_validity_sec = self.settings.get('recognition_result_validity_sec', 10)

        self.cargo_roi = self.settings.get('cargo_roi')
        if self.cargo_roi:
            logger.info(f"CargoDetector 將僅在 ROI 區域 {self.cargo_roi} 內偵測貨物。")
        else:
            logger.warning("CargoDetector 未設定 cargo_roi，將偵測整個畫面中的貨物。")

        self.enable_ocr_fallback = self.settings.get('enable_ocr_fallback', True)
        if self.enable_ocr_fallback and qr_scanner.pyzbar is None:
            logger.warning("已啟用 OCR 備案，但 pyzbar 未安裝。QR Code 掃描功能將不可用，OCR 備案標記可能被設置。")
        elif not self.enable_ocr_fallback:
            logger.info("已禁用 OCR 備案。")


        self.cargo_processing_event_type = EventType.CARGO_INFO_FOR_PROCESSING.value

        logger.info("CargoDetector 初始化成功。")

    # 添加一個方法用於從 main 函數更新 ROI 設定 (處理雲端命令)
    def update_roi(self, new_roi: List[int]):
        """
        更新 CargoDetector 的 ROI 設定。
        Args:
            new_roi (List[int]): 新的 ROI 座標 [x1, y1, x2, y2]。
        """
        if isinstance(new_roi, list) and len(new_roi) == 4:
            self.cargo_roi = new_roi
            logger.info(f"CargoDetector 已更新 ROI 設定為: {self.cargo_roi}")
        else:
            logger.warning(f"收到的新 ROI 格式無效，未更新: {new_roi}")


    def process(self, frame_cuda: jetson.utils.cudaImage, detections_raw: List[Any]):
        """
        處理貨物偵測邏輯。
        Args:
            frame_cuda (jetson.utils.cudaImage): 當前幀的 CUDA 影像數據。
            detections_raw (List[Any]): 物件偵測模型輸出的原始偵測結果列表 (預期類型為 List)。
        """
        # ... (process 方法開頭的檢查和獲取人臉識別結果邏輯，保持不變) ...
        if not self.is_enabled or not self.cargo_class_names or not self.s3_cargo_checkin_folder:
            # ... 日誌 ...
            return

        # 獲取最新的人臉識別結果
        latest_person_id = "no_person"
        latest_result_timestamp = 0
        latest_original_event_timestamp = 0
        latest_match_confidence = None
        latest_person_is_allowed = False

        with self.recognition_result_lock: # 使用鎖保護
            latest_person_id = self.recognition_result_state.get("person_id", "no_person")
            latest_result_timestamp = self.recognition_result_state.get("timestamp", 0)
            latest_original_event_timestamp = self.recognition_result_state.get("original_event_timestamp", 0)
            latest_match_confidence = self.recognition_result_state.get("match_confidence")
            if_violation = self.recognition_result_state.get("if_violation")
            violation_description = self.recognition_result_state.get("violation_description")

        current_time = time.time()

        is_recognition_result_valid = (current_time - latest_result_timestamp) < self.recognition_result_validity_sec
        if latest_person_id != "no_person" and latest_person_id != "unknown" and not latest_person_id.startswith("error_"):
             if self.allowed_person_ids and latest_person_id in self.allowed_person_ids:
                 if is_recognition_result_valid:
                      latest_person_is_allowed = True

        logger.debug(f"CargoDetector Status: Time={current_time:.2f}, Latest Person='{latest_person_id}', RecvTime={latest_result_timestamp:.2f}, Valid={is_recognition_result_valid}, Allowed={latest_person_is_allowed}")

        # --------------------------------------------------------------------
        # 如果沒有識別到允許的人物，則跳過貨物處理邏輯
        # --------------------------------------------------------------------
        if not latest_person_is_allowed:
            return
        
        # cargo = cup
        cooldown_key = f"{self.cargo_processing_event_type}_{latest_person_id}" # 冷卻鍵包含人物 ID

        # 檢查貨物事件冷卻時間
        if self.event_manager.should_trigger_event(cooldown_key, cooldown_override=self.cooldown_seconds):
            metadata = {
                "user_id": latest_person_id,
                "timestamp": latest_result_timestamp,
                "id": str(uuid.uuid4()),
                "cargo": "cup",
                "if_violation": if_violation,
                "violation_description": violation_description
            }
            self.event_publisher.publish_event(self.cargo_processing_event_type, metadata=metadata)
            # 記錄事件觸發時間 (用於冷卻)
            self.event_manager.record_event_triggered(cooldown_key)
        return
        # --------------------------------------------------------------------
        # 如果識別到允許的人物，則進行貨物偵測和處理
        # --------------------------------------------------------------------

        # 篩選出貨物偵測結果，並只考慮在 ROI 內的貨物
        cargo_detections = []
        cargo_detections_raw = [
            det for det in detections_raw
            if det and self.object_detector.class_mapping.get(det.ClassID) in self.cargo_class_names
        ]
        logger.debug(f"CargoDetector - Raw cargo detections ({len(self.cargo_class_names) if self.cargo_class_names else 0} classes): {len(cargo_detections_raw)}")


        if self.cargo_roi:
            frame_buffer = self.capture_manager.get_frame_buffer()
            current_frame_data = frame_buffer[-1] if frame_buffer else None

            if current_frame_data:
                for det in cargo_detections_raw:
                    center_x = (det.Left + det.Right) / 2
                    center_y = (det.Top + det.Bottom) / 2
                    if self.cargo_roi[0] <= center_x <= self.cargo_roi[2] and \
                        self.cargo_roi[1] <= center_y <= self.cargo_roi[3]:
                        cargo_detections.append(det)
            else:
                logger.warning("捕獲管理器緩衝區為空，無法檢查貨物 ROI。所有原始偵測到的貨物將被忽略 (如果配置了 ROI)。")
                cargo_detections = []


        else: # 沒有設定 ROI，處理所有偵測到的貨物
            cargo_detections = cargo_detections_raw

        logger.debug(f"CargoDetector - Filtered cargo detections (in ROI): {len(cargo_detections)}")


        # 如果在 ROI 內偵測到貨物，則觸發貨物信息處理事件
        if len(cargo_detections) > 0:
            first_cargo_detection = cargo_detections[0]

            event_type = self.cargo_processing_event_type
            cooldown_key = f"{event_type}_{latest_person_id}" # 冷卻鍵包含人物 ID

            # 檢查貨物事件冷卻時間
            if self.event_manager.should_trigger_event(cooldown_key, cooldown_override=self.cooldown_seconds):
                logger.info(f"事件 '{event_type}' 觸發 (與人物 {latest_person_id} 相關)。")

                # 獲取當前幀數據用於捕獲和 QR 掃描
                frame_buffer = self.capture_manager.get_frame_buffer()
                current_frame_data = frame_buffer[-1] if frame_buffer else None

                qr_data: Optional[str] = None
                needs_ocr_fallback = False

                if current_frame_data:
                    # ... 掃描 QR Code 邏輯 ...
                    cargo_bbox_np = [int(first_cargo_detection.Left), int(first_cargo_detection.Top), int(first_cargo_detection.Right), int(first_cargo_detection.Bottom)]
                    h, w = current_frame_data.frame_np.shape[:2]
                    x1, y1, x2, y2 = cargo_bbox_np
                    # 添加邊界擴展，確保QR碼完全在裁剪區域內
                    expansion_factor = 0.1  # 擴展原始邊界框10%
                    box_width = x2 - x1
                    box_height = y2 - y1

                    # 計算擴展值
                    x_expansion = int(box_width * expansion_factor)
                    y_expansion = int(box_height * expansion_factor)

                    # 擴展邊界，同時確保不超出圖像範圍
                    x1 = max(0, x1 - x_expansion)
                    y1 = max(0, y1 - y_expansion)
                    x2 = min(w, x2 + x_expansion)
                    y2 = min(h, y2 + y_expansion)
                    cargo_image_np = current_frame_data.frame_np[y1:y2, x1:x2]

                    # 添加驗證程式碼
                    if (x2 - x1) < 20 or (y2 - y1) < 20:
                        logger.warning(f"裁剪區域太小: {x2-x1}x{y2-y1}，可能影響QR碼識別")

                    # 可視化裁剪區域（用於調試）
                    # debug_frame = current_frame_data.frame_np.copy()
                    # cv2.rectangle(debug_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    # cv2.imwrite("/tmp/debug_crop_area.jpg", debug_frame)

                    qr_data = qr_scanner.scan_qr_code(cargo_image_np)

                    # ... 判斷是否需要 OCR 備案 ...
                    if qr_data is None and self.enable_ocr_fallback:
                        logger.warning("QR Code 掃描失敗，已啟用 OCR 備案，將標記需要雲端 OCR。")
                        needs_ocr_fallback = True
                    elif qr_data is None and not self.enable_ocr_fallback:
                        pass
                    elif qr_data is not None:
                        logger.info("QR Code 掃描成功。")

                else:
                    logger.error("捕獲管理器緩衝區為空，無法獲取當前幀進行 QR 掃描。")
                    qr_data = None
                    needs_ocr_fallback = False

                # --------------------------------------------------------------------
                # 步驟：構建貨物事件元數據
                # --------------------------------------------------------------------
                metadata: Dict[str, Any] = {
                    "cargo_count_in_frame": len(cargo_detections),
                    "cargo_detection_bbox_edge": [int(first_cargo_detection.Left), int(first_cargo_detection.Top), int(first_cargo_detection.Right), int(first_cargo_detection.Bottom)],
                    "cargo_detection_confidence_edge": float(first_cargo_detection.Confidence),
                    "frame_timestamp_edge": time.time(),

                    "related_person_id": latest_person_id,
                    "person_recognition_time": latest_result_timestamp,
                    "person_match_confidence": latest_match_confidence,

                    "qr_code_data": qr_data,
                    "needs_ocr_fallback": needs_ocr_fallback,

                    "cargo_roi": self.cargo_roi if self.cargo_roi else None,
                    "edge_thing_name": self.event_publisher.thing_name
                }


                # --------------------------------------------------------------------
                # 步驟：捕獲影像並發布事件
                # --------------------------------------------------------------------
                if current_frame_data: # 確保有當前幀數據
                    # # 在捕獲的影像上繪製貨物框、QR 框、OCR 狀態等
                    # frame_to_capture_np = current_frame_data.frame_np.copy()
                    # cargo_bbox_np_for_drawing = [int(first_cargo_detection.Left), int(first_cargo_detection.Top), int(first_cargo_detection.Right), int(first_cargo_detection.Bottom)]
                    # color = (0, 255, 255)
                    # thickness = 2
                    # cv2.rectangle(frame_to_capture_np, (cargo_bbox_np_for_drawing[0], cargo_bbox_np_for_drawing[1]), (cargo_bbox_np_for_drawing[2], cargo_bbox_np_for_drawing[3]), color, thickness)
                    # info_text = f"QR: {qr_data if qr_data else 'None'}"
                    # if needs_ocr_fallback:
                    #     info_text += " OCR Needed"
                    # text_pos_y = cargo_bbox_np_for_drawing[1] - 10
                    # if text_pos_y < 15: text_pos_y = cargo_bbox_np_for_drawing[3] + 15
                    # cv2.putText(frame_to_capture_np, info_text, (cargo_bbox_np_for_drawing[0], text_pos_y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, thickness)


                    frame_data_with_drawing = FrameData(
                        frame_np=current_frame_data.frame_np,
                        frame_cuda=current_frame_data.frame_cuda,
                        timestamp=current_frame_data.timestamp,
                        detections_raw=current_frame_data.detections_raw
                    )

                    # 捕獲並上傳貨物入庫影像
                    s3_image_path = self.capture_manager.capture_and_upload_image(
                        self.cargo_processing_event_type,
                        frame_data_with_drawing,
                        self.s3_cargo_checkin_folder, # <-- 傳入貨物入庫檔案夾
                        metadata # metadata 包含 QR/OCR 信息等
                    )

                    if s3_image_path:
                        self.event_publisher.publish_event(self.cargo_processing_event_type, s3_image_path=s3_image_path, metadata=metadata)
                        # 記錄事件觸發時間 (用於冷卻)
                        self.event_manager.record_event_triggered(cooldown_key)
                    else:
                        logger.warning(f"未能捕獲或添加到佇列影像用於貨物事件 '{self.cargo_processing_event_type}'。跳過發布事件訊息。")
                else:
                    logger.error("未能獲取當前幀數據用於貨物事件觸發。")

            # else:
            #      logger.debug(f"事件 '{event_type}' 仍在冷卻時間內，跳過觸發。")

        else:
            # 如果偵測到允許人物，但未在 ROI 內偵測到貨物，或者沒有配置 ROI 也沒有偵測到貨物
            pass



        # --------------------------------------------------------------------
        # 讀取並可能使用最新的貨物處理結果 (如果需要)
        # --------------------------------------------------------------------
        latest_cargo_info_data = "no_cargo_info"
        latest_cargo_result_timestamp = 0
        latest_cargo_related_person_id = "no_person"
        latest_proposed_location = "pending_assignment"

        with self.recognition_result_lock: # 使用同一個鎖保護
            latest_cargo_info_data = self.cargo_result_state.get("cargo_id_data", "no_cargo_info")
            latest_cargo_result_timestamp = self.cargo_result_state.get("timestamp", 0)
            latest_cargo_related_person_id = self.cargo_result_state.get("related_person_id", "no_person")
            latest_proposed_location = self.cargo_result_state.get("proposed_location", "pending_assignment")
            # 可以獲取 extraction_method, bedrock_summary_preview 等

        # 您可以在這裡使用這些最新的貨物處理結果，例如：
        # - 在顯示畫面上顯示最新的貨物 ID 和分配位置
        # - 根據分配的位置控制本地設備 (如果需要)
        # - 判斷是否需要清除狀態 (例如，當一個貨物被成功處理後)

        # 例如，如果分配了位置，並且這個結果與當前相關人物匹配，可以打印日誌
        # if latest_person_is_allowed and latest_cargo_info_data != "no_cargo_info" and latest_cargo_related_person_id == latest_person_id:
        #      logger.info(f"最新貨物 '{latest_cargo_info_data}' 已分配位置: {latest_proposed_location}")


# 移除人臉識別相關的輔助方法