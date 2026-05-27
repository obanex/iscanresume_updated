const { callGemini } = require("./services/geminiService");
const { buildPrompt } = require("./services/promptBuilder");
const { safeJsonExtract } = require("./services/parsers");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: "Method Not Allowed"
    };
  }

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  try {
    const body = JSON.parse(event.body || "{}");
    const { type, ...payload } = body;

    if (!type) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing type" })
      };
    }

    const prompt = buildPrompt(type, payload);

    const raw = await callGemini(prompt, {
      temperature: 0.5,
      maxTokens: 1500
    });

    let result;

    // Try JSON first, fallback to text
    try {
      result = safeJsonExtract(raw);
    } catch {
      result = raw;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ result })
    };

  } catch (err) {
    console.error("AI error:", err);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
