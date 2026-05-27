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
    const { resume } = JSON.parse(event.body);
    if (!resume) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No resume provided' }) };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1600,
        system: `You are an expert ATS resume analyser. Analyse the resume and return ONLY valid JSON, no markdown, no explanation:
{
  "atsScore": <integer 0-100 accurately reflecting resume quality>,
  "readability": <integer 0-100>,
  "wordCount": <integer>,
  "keywordsFound": <integer>,
  "keywordsMissing": <integer>,
  "weakBullets": <integer count of weak bullet points>,
  "sections": [
    {"name": "Summary", "score": <0-100>},
    {"name": "Experience", "score": <0-100>},
    {"name": "Skills", "score": <0-100>},
    {"name": "Education", "score": <0-100>},
    {"name": "Projects", "score": <0-100>}
  ],
  "feedback": [
    {"type": "error", "title": "...", "body": "..."},
    {"type": "warning", "title": "...", "body": "..."},
    {"type": "success", "title": "...", "body": "..."}
  ],
  "present": ["list", "of", "keywords", "found"],
  "missing": ["list", "of", "important", "missing", "keywords"]
}
Be accurate and vary scores based on actual resume quality. Strong resumes score 75-92, average 50-74, weak 20-49.`,
        messages: [{ role: 'user', content: `Analyse this resume:\n\n${resume.slice(0, 4000)}` }],
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const text = data.content.map(b => b.text || '').join('');
    const result = JSON.parse(text.replace(/```json|```/g, '').trim());

    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err) {
    console.error('analyze error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
