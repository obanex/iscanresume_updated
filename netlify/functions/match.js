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
    const { resume, jobDesc } = JSON.parse(event.body);
    if (!resume || !jobDesc) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Resume and job description required' }) };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: `You are a job-resume matching expert. Compare the resume to the job description and return ONLY valid JSON:
{
  "score": <integer 0-100 accurately reflecting match quality>,
  "matched": ["keywords", "found", "in", "both"],
  "missing": ["important", "keywords", "in", "job", "not", "in", "resume"],
  "suggestions": [
    "Specific actionable suggestion 1",
    "Specific actionable suggestion 2",
    "Specific actionable suggestion 3",
    "Specific actionable suggestion 4",
    "Specific actionable suggestion 5"
  ]
}
Score must accurately reflect the real overlap. 80-100 = strong match, 50-79 = moderate, below 50 = weak.`,
        messages: [{
          role: 'user',
          content: `Resume:\n${resume.slice(0, 2500)}\n\nJob Description:\n${jobDesc.slice(0, 2500)}`
        }],
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const text = data.content.map(b => b.text || '').join('');
    const result = JSON.parse(text.replace(/```json|```/g, '').trim());

    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err) {
    console.error('match error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
