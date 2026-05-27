exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  try {
    const { resume, jobDesc } = JSON.parse(event.body);
    if (!resume || !jobDesc) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Resume and job description required' }) };

    const prompt = `You are a job-resume matching expert. Compare this resume to the job description and return ONLY valid JSON, no markdown, no code blocks.

JSON structure:
{
  "score": <integer 0-100 accurately reflecting match quality>,
  "matched": ["keywords found in both resume and job description"],
  "missing": ["important keywords in job description missing from resume"],
  "suggestions": [
    "Specific actionable suggestion 1",
    "Specific actionable suggestion 2",
    "Specific actionable suggestion 3",
    "Specific actionable suggestion 4",
    "Specific actionable suggestion 5"
  ]
}

Score guide: 80-100 = strong match, 50-79 = moderate, below 50 = weak.
Return at least 5 matched keywords, 5 missing keywords, and 5 suggestions.

Resume:
${resume.slice(0, 2500)}

Job Description:
${jobDesc.slice(0, 2500)}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
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
    console.error('match error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
