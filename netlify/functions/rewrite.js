exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  try {
    const { bullet } = JSON.parse(event.body);
    if (!bullet) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No bullet provided' }) };

    const prompt = `You are an expert resume writer. Rewrite this weak resume bullet point into a compelling, metrics-driven achievement.

Rules:
- Start with a powerful action verb (Built, Engineered, Architected, Optimised, Led, Delivered, Reduced, Increased, Launched, Scaled, Developed)
- Add specific quantitative metrics where logical (%, time saved, users served, revenue, team size)
- Keep to 1-2 sentences maximum
- Sound professional and natural
- Return ONLY the rewritten bullet point — no explanation, no prefix, no bullet symbol, no quotes

Bullet to rewrite: ${bullet}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
        }),
      }
    );

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    return { statusCode: 200, headers, body: JSON.stringify({ result }) };
  } catch (err) {
    console.error('rewrite error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
 
