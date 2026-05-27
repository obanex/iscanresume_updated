exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  try {
    const { resume } = JSON.parse(event.body);
    if (!resume) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No resume provided' }) };

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
- atsScore must ACCURATELY reflect resume quality. Strong resume = 75-92, average = 50-74, weak = 20-49
- Every resume is different — do NOT return the same score every time
- Base scores on actual content, not assumptions
- Return at least 3 feedback items (mix of error/warning/success)
- Return at least 5 present keywords and 5 missing keywords

Resume to analyse:
${resume.slice(0, 4000)}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1500 },
        }),
      }
    );



    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    text = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    
    if (start === -1 || end === -1) {
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
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err) {
    console.error('analyze error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
