import { AIAnalysisPort } from '../../../application/ai-ports/AIAnalysisPort.js';

async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
  const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS || 10000);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (response.ok) return response;

      const responseText = await response.text();
      const errorMessage = responseText ? ` ${responseText}` : '';

      if (attempt < retries && (response.status === 429 || response.status >= 500)) {
        await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
        continue;
      }

      throw new Error(`OpenRouter API error ${response.status}${errorMessage}`);
    } catch (error) {
      if (error.name === 'AbortError') {
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
          continue;
        }
        throw new Error(`OpenRouter API timeout after ${timeoutMs}ms`);
      }

      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
        continue;
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export class OpenRouterAdapter extends AIAnalysisPort {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || '';
    this.baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.httpReferer = process.env.OPENROUTER_HTTP_REFERER || '';
    this.xTitle = process.env.OPENROUTER_TITLE || 'ai-log-auditor';

    if (!this.apiKey) {
      console.warn('Cảnh báo: Chưa cấu hình OPENROUTER_API_KEY trong file .env!');
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`
    };

    if (this.httpReferer) {
      headers['HTTP-Referer'] = this.httpReferer;
    }

    if (this.xTitle) {
      headers['X-Title'] = this.xTitle;
    }

    return headers;
  }

  async generateEmbedding(text) {
    try {
      const embeddingModel = process.env.OPENROUTER_EMBEDDING_MODEL || 'openai/text-embedding-3-small';
      const response = await fetchWithRetry(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: embeddingModel,
          input: text
        })
      });

      const result = await response.json();
      return result?.data?.[0]?.embedding || Array(1536).fill(0);
    } catch (error) {
      console.error('Lỗi khi gọi OpenRouter Embedding:', error.message);
      return Array(1536).fill(0);
    }
  }

  async detectAnomaly(currentLog, recentLogs) {
    try {
      const generationModel = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
      const historyContext = recentLogs.map(log =>
        `[${log.timestamp.toISOString()}] [${log.level}] ${log.message}`
      ).join('\n');

      const systemPrompt = `
        Bạn là một Kỹ sư DevOps AI (DevOps AI Engineer). Nhiệm vụ của bạn là phân tích dòng Log hiện tại trong bối cảnh các Log gần đây để phát hiện sự cố hệ thống.

        Yêu cầu bắt buộc: Trả về kết quả đúng định dạng JSON khớp chính xác với cấu trúc yêu cầu dưới đây. Không bọc kết quả trong các ký tự markdown như \`\`\`json.
      `;

      const userPrompt = `
        LỊCH SỬ LOG GẦN ĐÂY (15 phút qua):
        ${historyContext || 'Không có log lỗi nào gần đây.'}

        DÒNG LOG HIỆN TẠI VỪA NHẬN ĐƯỢC:
        [Thời gian]: ${currentLog.timestamp.toISOString()}
        [Mức độ]: ${currentLog.level}
        [Nội dung]: ${currentLog.message}

        Hãy phân tích và trả về cấu trúc JSON sau:
        {
          "isAnomaly": boolean,
          "description": string,
          "confidence": number,
          "rootCause": string
        }
      `;

      const response = await fetchWithRetry(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: generationModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0,
          response_format: { type: 'json_object' }
        })
      });

      const result = await response.json();
      const textResponse = result?.choices?.[0]?.message?.content;

      if (!textResponse) {
        throw new Error('Không nhận được dữ liệu phản hồi từ OpenRouter API.');
      }

      return typeof textResponse === 'string' ? JSON.parse(textResponse) : textResponse;
    } catch (error) {
      console.error('Lỗi khi phân tích bất thường với OpenRouter:', error.message);
      return {
        isAnomaly: false,
        description: 'Tạm thời không thể kết nối tới mô hình AI để phân tích',
        confidence: 0,
        rootCause: 'Hệ thống AI đang bảo trì hoặc mạng cục bộ gặp sự cố'
      };
    }
  }
}

export class GeminiAdapter extends OpenRouterAdapter {}
