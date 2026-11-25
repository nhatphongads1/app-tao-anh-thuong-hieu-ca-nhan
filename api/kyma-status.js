"use strict";

// GET /api/kyma-status — chỉ báo key đã cấu hình hay chưa, KHÔNG trả key.
// Key Kyma chỉ nằm trong Environment Variable KYMA_API_KEY trên Vercel.
module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  var configured = Boolean(process.env.KYMA_API_KEY);
  return res.status(200).json({
    configured: configured,
    chatModel: "qwen3.7-flash",
    imageModel: "minimax-image-01",
    imageCost: "$0.005/ảnh"
  });
};
