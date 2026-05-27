exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: 'Method Not Allowed'
    };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    const body = JSON.parse(event.body || '{}');
    const { resume, jobDesc } = body;

    if (!resume || !jobDesc) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Resume and job description required'
        })
      };
    }

    const prompt = `
You are a job-resume matching expert.

Return ONLY valid JSON:

{
  "score": 0-100,
  "matched": [],
  "missing": [],
  "suggestions": []
}

Rules:
- 5+ matched keywords
- 5+ missing keywords
- 5+ suggestions
- Score must reflect real match quality

Resume:
${resume.slice(0, 2500)}

Job Description:
${jobDesc.slice(0, 2500)}
`;

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('Missing GEMINI_API_KEY');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: "user",   // ✅ FIXED
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 800
          }
        })
      }
    );

    const raw = await response.text();
    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      console.error('Non-JSON response:', raw);
      throw new Error('Invalid response from Gemini');
    }

    if (!response.ok) {
      console.error('Gemini error:', data);
      throw new Error(data?.error?.message || 'Gemini request failed');
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    const cleaned = text.replace(/```json|```/g, '').trim();

    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start === -1 || end === -1) {
      console.error('Invalid AI output:', cleaned);
      throw new Error('AI did not return valid JSON');
    }

    const jsonString = cleaned.slice(start, end + 1);

    let result;

    try {
      result = JSON.parse(jsonString);
    } catch (err) {
      console.error('JSON parse failed:', jsonString);
      throw new Error('Failed to parse AI response');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };

  } catch (err) {
    console.error('match error:', err);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
