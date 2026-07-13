export class LogRepositoryPort {
  // Lưu LogEntry vào cơ sở dữ liệu
  async save(logEntry) {
    throw new Error('Phương thức save() chưa được cài đặt ở tầng Infrastructure!');
  }

  // Lấy danh sách log trong một khoảng thời gian (Sliding Window) để phân tích tần suất
  async findByTimeWindow(service, minutes) {
    throw new Error('Phương thức findByTimeWindow() chưa được cài đặt!');
  }

  // Lưu một cảnh báo bất thường
  async saveAlert(anomalyAlert) {
    throw new Error('Phương thức saveAlert() chưa được cài đặt!');
  }
}