export class LogEntry {
  constructor({ id, timestamp, level, service, message, metadata = {}, vector = null }) {
    this.id = id;
    this.timestamp = timestamp ? new Date(timestamp) : new Date();
    this.level = level?.toLowerCase() || 'info'; // info, warning, error, critical
    this.service = service || 'unknown-service';
    this.message = message;
    this.metadata = metadata; // IP, UserId,..
    this.vector = vector;     // Mảng các số thực (Embedding Vector) phục vụ AI phân tích
  }

  // Kiểm tra xem dòng log này đã được mô hình AI số hóa thành Vector chưa
  hasVector() {
    return Array.isArray(this.vector) && this.vector.length > 0;
  }

  // Quy tắc nghiệp vụ: Xác định xem log này có nguy cơ gây nguy hiểm ngay lập tức không
  isCritical() {
    return this.level === 'error' || this.level === 'critical';
  }
}