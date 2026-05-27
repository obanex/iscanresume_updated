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
      body: 'Method Not Allowed'
    };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    const { resume } = JSON.parse(event.body);

    if (!resume) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'No resume provided'
        })
      };
    }

    const prompt = `You are an expert ATS resume analyser. Analyse this resume and return ONLY valid JSON, no markdown, no explanation, no code blocks.

The JSON must follow this exact structure:
{
  "atsScore": <integer 0-100 based on actual resume quality>,
  "readability": <integer 0-100>,
  "wordCount": <integer>,
  "keywordsFound": <integer>,
  "keywordsMissing": <integer>,
  "weakBullets": <integer>,
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
  "present": ["keyword1", "keyword2"],
  "missing": ["keyword1", "keyword2"]
}

Rules:
- atsScore must ACCURATELY reflect resume quality
- Strong resume = 75-92
- Average resume = 50-74
- Weak resume = 20-49
- Do NOT return the same score every time
- Return at least 3 feedback items
- Return at least 5 present keywords
- Return at least 5 missing keywords

Resume to analyse:
${resume.slice(0, 4000)}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1500
          }
        })
      }
    );

    // CHECK FOR GEMINI API ERRORS
    if (!response.ok) {
      const errorText = await response.text();

      console.error('Gemini API error:', errorText);

      throw new Error(`Gemini API failed: ${response.status}`);
    }

    const data = await response.json();

    let text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // CLEAN RESPONSE
    text = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    // EXTRACT JSON SAFELY
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');

    if (start === -1 || end === -1) {
      console.error('INVALID GEMINI RESPONSE:', text);

      throw new Error('Gemini returned invalid JSON');
    }

    const cleanJson = text.slice(start, end + 1);

    let result;

    try {
      result = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.error('JSON PARSE ERROR:', cleanJson);

      throw new Error('Failed to parse AI response');
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
