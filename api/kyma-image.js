"use strict";

// POST /api/kyma-image { prompt, ratio }
// Tạo 1 ảnh nền AI bằng Kyma. Model duy nhất được dùng: minimax-image-01
// (free-tier, $0.005/ảnh — model ảnh duy nhất trong free tier).
// Endpoint tạo ảnh của Kyma là bất đồng bộ: POST trả job id, poll job tới khi xong.
// Key chỉ đọc từ process.env.KYMA_API_KEY, không log key, không log prompt.
var IMAGE_MODEL = "minimax-image-01";
var IMAGE_COST = "$0.005/ảnh";
var KYMA_BASE = "https://kymaapi.com/v1";

var SIZES = {
  "1:1": "1024x1024",
  "4:5": "1024x1280",
  "9:16": "768x1344",
  "16:9": "1344x768"
};

function readBody(req) {
  if (req.body == null) return {};
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body;
}

function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

// Tìm URL/base64 ảnh trong job mà Kyma trả về, giữ nguyên mọi trường job gốc.
function findImage(job) {
  if (!job || typeof job !== "object") return {};
  var candidates = [job, job.result, job.data, job.output];
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (!c) continue;
    if (typeof c === "string" && /^https?:\/\//.test(c)) return { imageUrl: c };
    if (Array.isArray(c) && c[0]) {
      var first = c[0];
      if (typeof first === "string" && /^https?:\/\//.test(first)) return { imageUrl: first };
      if (first && typeof first === "object") {
        if (first.url) return { imageUrl: first.url };
        if (first.b64_json) return { imageBase64: first.b64_json };
      }
    }
    if (typeof c === "object") {
      if (c.url) return { imageUrl: c.url };
      if (c.image_url) return { imageUrl: c.image_url };
      if (c.b64_json) return { imageBase64: c.b64_json };
    }
  }
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  var apiKey = process.env.KYMA_API_KEY;
  if (!apiKey) return res.status(501).json({ error: "not_configured" });

  var body = readBody(req);
  var prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return res.status(400).json({ error: "missing_prompt" });
  if (prompt.length > 1000) return res.status(400).json({ error: "prompt_too_long" });
  var size = SIZES[body.ratio] || SIZES["1:1"];

  var headers = {
    "Authorization": "Bearer " + apiKey,
    "Content-Type": "application/json"
  };

  try {
    var r = await fetch(KYMA_BASE + "/images/generations", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ model: IMAGE_MODEL, prompt: prompt, size: size })
    });
    if (!r.ok) {
      var status = r.status;
      if (status === 402) return res.status(402).json({ error: "kyma_out_of_credit" });
      if (status === 401 || status === 403) return res.status(502).json({ error: "kyma_auth_failed" });
      return res.status(502).json({ error: "kyma_error", status: status });
    }
    var created = await r.json();
    var jobId = created && (created.job_id || created.id ||
      (created.job && created.job.id));
    if (!jobId) return res.status(502).json({ error: "no_job_id", job: created });

    // Poll tối đa ~55 giây (giới hạn thời gian chạy của Vercel free).
    var deadline = Date.now() + 55000;
    var job = null;
    while (Date.now() < deadline) {
      await sleep(2500);
      var pr = await fetch(KYMA_BASE + "/jobs/" + encodeURIComponent(jobId), { headers: headers });
      if (!pr.ok) return res.status(502).json({ error: "kyma_error", status: pr.status });
      job = await pr.json();
      var st = String((job && (job.status || job.state)) || "").toLowerCase();
      if (st === "succeeded" || st === "completed" || st === "success") break;
      if (st === "failed" || st === "error" || st === "cancelled") {
        return res.status(502).json({ error: "job_failed", job: job });
      }
      job = job; // vẫn đang chạy: queued / processing / running
    }
    var finalStatus = String((job && (job.status || job.state)) || "").toLowerCase();
    if (finalStatus !== "succeeded" && finalStatus !== "completed" && finalStatus !== "success") {
      return res.status(504).json({ error: "job_timeout", job: job });
    }
    var found = findImage(job);
    return res.status(200).json({
      imageUrl: found.imageUrl || null,
      imageBase64: found.imageBase64 || null,
      model: IMAGE_MODEL,
      cost: IMAGE_COST,
      job: job
    });
  } catch (e) {
    return res.status(502).json({ error: "kyma_unreachable" });
  }
};
