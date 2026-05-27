exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const { bullet } = JSON.parse(event.body);
    if (!bullet) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No bullet provided' }) };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: `You are an expert resume writer. Rewrite weak resume bullet points into compelling, metrics-driven achievements.
Rules:
- Start with a powerful action verb (Built, Engineered, Architected, Optimised, Led, Delivered, Reduced, Increased, Launched, Scaled)
- Add specific quantitative metrics where logical (%, time saved, users, revenue, team size)
- Keep to 1-2 sentences maximum
- Sound professional and natural
- Return ONLY the rewritten bullet — no explanation, no prefix, no bullet symbol`,
        messages: [{ role: 'user', content: `Rewrite this resume bullet point:\n\n"${bullet}"` }],
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const result = data.content.map(b => b.text || '').join('').trim();
    return { statusCode: 200, headers, body: JSON.stringify({ result }) };
  } catch (err) {
    console.error('rewrite error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
