exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  try {
    const { messages, resume, analysis } = JSON.parse(event.body);
    if (!messages) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Messages required' }) };

    // Build context
    let context = `You are iScanResume's AI career coach — an expert recruiter and career advisor with 15 years of experience. Help candidates improve their resumes, prepare for interviews, and navigate their job search. Be specific, actionable, direct, and encouraging. Use bullet points for lists. Keep responses concise (under 200 words unless detail is truly needed).`;

    if (resume) context += `\n\nCandidate's resume:\n${resume.slice(0, 3000)}`;
    if (analysis) {
      context += `\n\nLatest ATS score: ${analysis.atsScore}/100.`;
      const errors = (analysis.feedback || []).filter(f => f.type === 'error').map(f => f.title);
      if (errors.length) context += ` Key issues: ${errors.join('; ')}.`;
      if (analysis.missing?.length) context += ` Missing keywords: ${analysis.missing.slice(0, 8).join(', ')}.`;
    }

    // Build conversation history for Gemini
    // Gemini uses "user" and "model" roles
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: context }] },
          contents: [
            ...history,
            { role: 'user', parts: [{ text: lastMessage.content }] },
          ],
          generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
        }),
      }
    );

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "I'm having trouble responding right now. Please try again.";
    return { statusCode: 200, headers, body: JSON.stringify({ result }) };
  } catch (err) {
    console.error('chat error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
