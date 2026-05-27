export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { type, ...data } = body;

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    let prompt = "";

    /* ───────────────────────── ANALYZE ───────────────────────── */
    if (type === "analyze") {
      const { resume } = data;

      if (!resume) throw new Error("Missing resume");

      prompt = `
You are an ATS resume analyser.

Return ONLY valid JSON:
{
  "atsScore": number,
  "readability": number,
  "wordCount": number,
  "keywordsFound": number,
  "keywordsMissing": number,
  "weakBullets": number,
  "feedback": [
    {"type":"error","title":"...","body":"..."},
    {"type":"warning","title":"...","body":"..."},
    {"type":"success","title":"...","body":"..."}
  ],
  "present": [],
  "missing": []
}

Resume:
${resume.slice(0, 4000)}
`;
    }

    /* ───────────────────────── REWRITE ───────────────────────── */
    if (type === "rewrite") {
      const { bullet } = data;

      prompt = `
Rewrite this resume bullet professionally with metrics:

${bullet}

Return ONLY the rewritten bullet.
`;
    }

    /* ───────────────────────── MATCH ───────────────────────── */
    if (type === "match") {
      const { resume, jobDesc } = data;

      prompt = `
Compare resume to job description.

Return ONLY JSON:
{
  "score": number,
  "matched": [],
  "missing": [],
  "suggestions": []
}

Resume:
${resume}

Job:
${jobDesc}
`;
    }

    /* ───────────────────────── INTERVIEW ───────────────────────── */
    if (type === "interview") {
      const { resume, role, types } = data;

      prompt = `
Generate interview questions for role: ${role}

Types: ${types.join(",")}

Return ONLY JSON:
{
  "total": number,
  "questions": {}
}

Resume:
${resume}
`;
    }

    /* ───────────────────────── CHAT ───────────────────────── */
    if (type === "chat") {
      const { messages } = data;

      prompt = `
You are a career coach.

Respond helpfully to the last message.

Chat:
${JSON.stringify(messages)}
`;
    }

    if (!prompt) {
      throw new Error("Invalid type");
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1200,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini error:", data);
      throw new Error(data.error?.message || "Gemini failed");
    }

    let text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    text = text.replace(/```json|```/g, "").trim();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ result: text }),
    };
  } catch (err) {
    console.error("AI ERROR:", err);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: err.message,
      }),
    };
  }
};
