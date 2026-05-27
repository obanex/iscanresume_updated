exports.handler = async (event) => {
  // Handle CORS preflight
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
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: 'Method Not Allowed'
    };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    const { resume } = JSON.parse(event.body || '{}');

    if (!resume) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No resume provided' })
      };
    }

    const prompt = `You are an expert ATS resume analyser. Return ONLY valid JSON (no markdown, no explanation).

JSON format:
{
  "atsScore": 0-100,
  "readability": 0-100,
  "wordCount": number,
  "keywordsFound": number,
  "keywordsMissing": number,
  "weakBullets": number,
  "sections": [
    {"name": "Summary", "score": 0-100},
    {"name": "Experience", "score": 0-100},
    {"name": "Skills", "score": 0-100},
    {"name": "Education", "score": 0-100},
    {"name": "Projects", "score": 0-100}
  ],
  "feedback": [
    {"type": "error", "title": "...", "body": "..."},
    {"type": "warning", "title": "...", "body": "..."},
    {"type": "success", "title": "...", "body": "..."}
  ],
  "present": ["keyword1"],
  "missing": ["keyword1"]
}

Rules:
- Return realistic scores (do NOT repeat same values)
- At least 3 feedback items
- At least 5 present and missing keywords

Resume:
${resume.slice(0, 4000)}`;

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('Missing GEMINI_API_KEY environment variable');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",   // ✅ FIXED (this was missing before)
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.4,
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
      console.error('Non-JSON response from Gemini:', raw);
      throw new Error('Invalid response from Gemini API');
    }

    if (!response.ok) {
      console.error('Gemini API error response:', data);
      throw new Error(data?.error?.message || 'Gemini API request failed');
    }

    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('Empty Gemini response:', data);
      throw new Error('Gemini returned empty response');
    }

    // Clean response
    text = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    // Extract JSON safely
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');

    if (start === -1 || end === -1) {
      console.error('Invalid AI output:', text);
      throw new Error('AI did not return valid JSON');
    }

    const cleanJson = text.slice(start, end + 1);

    let result;
    try {
      result = JSON.parse(cleanJson);
    } catch (err) {
      console.error('JSON parse failed:', cleanJson);
      throw new Error('Failed to parse AI-generated JSON');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };

  } catch (err) {
    console.error('analyze error:', err);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: err.message
      })
    };
  }
};
