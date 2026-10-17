"""AI errors with learner-friendly Vietnamese messages. Never include secrets in messages."""
from __future__ import annotations


class AIError(Exception):
    status_code = 503
    code = "ai_error"
    message_vi = "Tính năng AI tạm thời không dùng được. Bài học và bài tập có sẵn vẫn hoạt động bình thường."

    def __init__(self, detail: str | None = None):
        super().__init__(detail or self.message_vi)
        self.detail = detail

    def to_dict(self) -> dict:
        return {"code": self.code, "message": self.message_vi, "retryable": self.status_code in (429, 502, 503, 504)}


class AIDisabled(AIError):
    code = "ai_disabled"
    message_vi = "Chưa cấu hình AI (thiếu OPENAI_API_KEY) hoặc AI đang tắt trong Cài đặt. Các bài học có sẵn vẫn dùng bình thường."


class AIRateLimited(AIError):
    status_code = 429
    code = "rate_limited"
    message_vi = "Bạn gửi yêu cầu AI hơi nhanh. Chờ khoảng một phút rồi thử lại."


class AIDailyLimit(AIError):
    status_code = 429
    code = "daily_limit"
    message_vi = "Đã dùng hết số lượt AI trong ngày (có thể đổi giới hạn trong Cài đặt). Bài học có sẵn vẫn dùng được."


class AIBudgetExceeded(AIError):
    status_code = 402
    code = "budget_exceeded"
    message_vi = "Đã chạm ngân sách AI của tháng. Tăng ngân sách trong Cài đặt hoặc chờ sang tháng mới; bài học có sẵn vẫn dùng được."


class AIQuotaExceeded(AIError):
    status_code = 503
    code = "provider_quota"
    message_vi = "Tài khoản OpenAI đã hết hạn mức (quota). Kiểm tra billing của API key. Bài học có sẵn vẫn dùng được."


class AIUnavailable(AIError):
    status_code = 503
    code = "provider_unavailable"
    message_vi = "Dịch vụ AI đang quá tải hoặc tạm lỗi. Bài làm của bạn chưa bị mất — hãy thử lại sau ít phút."


class AITimeout(AIError):
    status_code = 504
    code = "timeout"
    message_vi = "AI phản hồi quá lâu. Bài làm của bạn vẫn còn — hãy thử lại."


class AIConfigError(AIError):
    status_code = 503
    code = "config_error"
    message_vi = "Cấu hình AI chưa đúng (API key không hợp lệ hoặc model không truy cập được). Kiểm tra trang Cài đặt → AI."


class AIInvalidOutput(AIError):
    status_code = 502
    code = "invalid_output"
    message_vi = "AI trả về nội dung không hợp lệ nên hệ thống đã loại bỏ. Hãy thử lại."


class AIBadInput(AIError):
    status_code = 422
    code = "bad_input"
    message_vi = "Dữ liệu gửi lên không hợp lệ."

    def __init__(self, detail: str | None = None):
        super().__init__(detail)
        # Callers supply bounded, learner-facing validation reasons, never
        # upstream API exception text or secret configuration.
        self.message_vi = detail or type(self).message_vi
