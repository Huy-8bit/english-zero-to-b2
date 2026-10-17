"""Exercise the installed official SDK over mock HTTP; these are NOT live API tests."""
import json

import httpx
import openai
import pytest
from pydantic import BaseModel

from app.ai.errors import AIConfigError, AIInvalidOutput, AIQuotaExceeded
from app.ai.provider import OpenAIProvider
from app.ai.settings import load_settings


class Answer(BaseModel):
    explanation_vi: str


def provider(handler):
    settings = load_settings()
    settings.api_key = "test-placeholder"
    p = OpenAIProvider(settings)
    p.client.close()
    p.client = openai.OpenAI(api_key=settings.api_key, max_retries=0,
                            http_client=httpx.Client(transport=httpx.MockTransport(handler)))
    return p


def response(text):
    return {"id": "resp_test", "created_at": 1, "model": "test-model", "object": "response", "status": "completed",
            "output": [{"type": "message", "id": "msg_test", "role": "assistant", "status": "completed",
                        "content": [{"type": "output_text", "text": text, "annotations": []}]}],
            "usage": {"input_tokens": 15, "output_tokens": 8, "total_tokens": 23}}


def test_responses_sdk_structured_contract():
    def handler(request):
        body = json.loads(request.content)
        assert request.url.path == "/v1/responses"
        assert body["store"] is False and body["max_output_tokens"] == 500
        assert body["text"]["format"]["type"] == "json_schema"
        assert body["text"]["format"]["strict"] is True
        assert body["text"]["format"]["schema"]["additionalProperties"] is False
        return httpx.Response(200, json=response('{"explanation_vi":"Động từ thêm -s."}'))
    p = provider(handler)
    parsed, usage = p.structured(model="test-model", instructions="Teach", input="Why?", schema=Answer, max_output_tokens=500)
    assert parsed.explanation_vi == "Động từ thêm -s." and usage.input_tokens == 15
    p.client.close()


def test_invalid_structured_output_has_safe_error():
    p = provider(lambda request: httpx.Response(200, json=response('{"wrong_field":1}')))
    with pytest.raises(AIInvalidOutput):
        p.structured(model="test-model", instructions="Teach", input="Why?", schema=Answer, max_output_tokens=500)
    p.client.close()


@pytest.mark.parametrize("status,code,expected", [(401, "invalid_api_key", AIConfigError), (429, "insufficient_quota", AIQuotaExceeded)])
def test_provider_errors_never_echo_sensitive_body(status, code, expected):
    p = provider(lambda request: httpx.Response(status, json={"error": {"code": code, "message": "secret-in-provider-error"}}))
    with pytest.raises(expected) as exc:
        p.text(model="test-model", instructions="Teach", input="Why?", max_output_tokens=500)
    assert "secret-in-provider-error" not in str(exc.value)
    p.client.close()
