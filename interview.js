exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  try {
    const { resume, role, types } = JSON.parse(event.body);
    if (!resume || !role || !types) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Resume, role, and types required' }) };

    const prompt = `You are a senior technical interviewer. Generate personalised interview questions based on the candidate's actual resume and target role.

Return ONLY valid JSON, no markdown, no code blocks:
{
  "total": <number>,
  "questions": {
    "Behavioral": [
      {"question": "Question specific to their experience", "hint": "Brief tip on how to answer"},
      {"question": "...", "hint": "..."}
    ],
    "Technical": [
      {"question": "...", "hint": "..."},
      {"question": "...", "hint": "..."}
    ]
  }
}

Rules:
- Only include question types from this list: ${types.join(', ')}
- Make every question specific to the candidate's actual experience in their resume
- Each requested type should have 2-3 questions
- Hints should be practical and concise

Target role: ${role}

Resume:
${resume.slice(0, 2500)}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 1500 },
        }),
      }
    );

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text.replace(/```json|```/g, '').trim();

    const result = JSON.parse(text);
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err) {
    console.error('interview error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
