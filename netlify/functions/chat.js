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
    const { messages = [], resume, analysis } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Messages required' })
      };
    }

    const context = `
You are iScanResume's AI career coach — an expert recruiter and career advisor with 15 years of experience.
Be specific, actionable, and concise (max 200 words unless needed).
`;

    let enhancedContext = context;

    if (resume) {
      enhancedContext += `\n\nResume:\n${resume.slice(0, 3000)}`;
    }

    if (analysis) {
      enhancedContext += `\n\nATS Score: ${analysis.atsScore}/100`;

      const errors = (analysis.feedback || [])
        .filter(f => f.type === 'error')
        .map(f => f.title);

      if (errors.length) {
        enhancedContext += `\nKey issues: ${errors.join(', ')}`;
      }

      if (analysis.missing?.length) {
        enhancedContext += `\nMissing keywords: ${analysis.missing.slice(0, 8).join(', ')}`;
      }
    }

    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content || '' }]
    }));

    const lastMessage = messages[messages.length - 1];

    if (!lastMessage?.content) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Last message is empty' })
      };
    }

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
            ...history,
            {
              role: 'user',
              parts: [{ text: lastMessage.content }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
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
      console.error('Non-JSON Gemini response:', raw);
      throw new Error('Invalid response from Gemini');
    }

    if (!response.ok) {
      console.error('Gemini error:', data);
      throw new Error(data?.error?.message || 'Gemini request failed');
    }

    const result =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!result) {
      console.error('Empty Gemini output:', data);
      throw new Error('Gemini returned empty response');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ result })
    };

  } catch (err) {
    console.error('chat error:', err);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
