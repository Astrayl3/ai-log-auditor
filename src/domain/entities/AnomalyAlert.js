export class AnomalyAlert {
  constructor({ id, type, description, confidence, timestamp, affectedServices = [], rootCause = '' }) {
    this.id = id;
    this.type = type;               
    this.description = description; 
    this.confidence = confidence;   // Độ chính xác của dự đoán (0.0 đến 1.0)
    this.timestamp = timestamp || new Date();
    this.affectedServices = affectedServices; // Danh sách các service bị ảnh hưởng
    this.rootCause = rootCause;     // Nguyên nhân gốc rễ do AI phân tích đồ thị log
  }

  // Quy tắc nghiệp vụ: Chỉ kích hoạt cảnh báo khẩn cấp nếu độ tự tin của AI đủ cao
  shouldTriggerUrgentNotification() {
    return this.confidence >= 0.85;
  }
}