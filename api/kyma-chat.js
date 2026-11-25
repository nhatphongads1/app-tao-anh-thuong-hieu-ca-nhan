"use strict";

// POST /api/kyma-chat { text }
// Lọc nội dung người dùng dán thành 5 câu tiêu đề 6-9 từ bằng Kyma.
// Model duy nhất được dùng: qwen3.7-flash (free-tier, rẻ nhất).
// Key chỉ đọc từ process.env.KYMA_API_KEY, không log key, không log body.
var CHAT_MODEL = "qwen3.7-flash";
var KYMA_URL = "https://kymaapi.com/v1/chat/completions";

function readBody(req) {
  if (req.body == null) return {};
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  var apiKey = process.env.KYMA_API_KEY;
  if (!apiKey) return res.status(501).json({ error: "not_configured" });

  var body = readBody(req);
  var text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return res.status(400).json({ error: "missing_text" });
  if (text.length > 20000) return res.status(400).json({ error: "text_too_long" });

  try {
    var r = await fetch(KYMA_URL, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          {
            role: "system",
            content: "Bạn là trợ lý lọc tiêu đề cho ảnh thương hiệu cá nhân của phụ nữ Việt Nam. Trả về đúng 5 câu tiêu đề, mỗi câu 6-9 từ, ngắn gọn, mạnh, sang trọng, đúng ý nội dung người dùng đưa. Mỗi câu một dòng, không đánh số, không giải thích thêm, không thêm câu nào khác."
          },
          { role: "user", content: text }
        ],
        temperature: 0.7,
        max_tokens: 400
      })
    });
    if (!r.ok) {
      var status = r.status;
      if (status === 402) return res.status(402).json({ error: "kyma_out_of_credit" });
      if (status === 401 || status === 403) return res.status(502).json({ error: "kyma_auth_failed" });
      return res.status(502).json({ error: "kyma_error", status: status });
    }
    var data = await r.json();
    var content = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content : "";
    var lines = String(content || "").split(/\r?\n/)
      .map(function (x) { return x.replace(/^[\s•\-–—*#\d.)]+/, "").trim(); })
      .filter(function (x) { return x.length >= 6 && x.length <= 120; })
      .slice(0, 5);
    if (!lines.length) return res.status(502).json({ error: "empty_result" });
    return res.status(200).json({ lines: lines });
  } catch (e) {
    return res.status(502).json({ error: "kyma_unreachable" });
  }
};
