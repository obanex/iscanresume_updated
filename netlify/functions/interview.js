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
    const { resume, role, types = [] } = body;

    if (!resume || !role || !Array.isArray(types) || types.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Resume, role, and types (array) required'
        })
      };
    }

    const prompt = `
You are a senior technical interviewer.

Return ONLY valid JSON (no markdown, no explanation):

{
  "total": number,
  "questions": {
    "Behavioral": [
      {"question": "", "hint": ""}
    ],
    "Technical": [
      {"question": "", "hint": ""}
    ]
  }
}

Rules:
- Only include types: ${types.join(', ')}
- Questions must be based on the resume
- 2-3 questions per type
- Hints must be short and practical

Role: ${role}

Resume:
${resume.slice(0, 2500)}
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
            temperature: 0.5,
            maxOutputTokens: 1500
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
      throw new Error('Invalid Gemini response');
    }

    if (!response.ok) {
      console.error('Gemini error:', data);
      throw new Error(data?.error?.message || 'Gemini request failed');
    }

    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    text = text.replace(/```json|```/g, '').trim();

    // SAFE JSON EXTRACTION (prevents random crashes)
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');

    if (start === -1 || end === -1) {
      console.error('Invalid AI output:', text);
      throw new Error('AI did not return valid JSON');
    }

    const clean = text.slice(start, end + 1);

    let result;
    try {
      result = JSON.parse(clean);
    } catch (err) {
      console.error('JSON parse failed:', clean);
      throw new Error('Failed to parse AI response');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };

  } catch (err) {
    console.error('interview error:', err);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
