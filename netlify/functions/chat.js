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
    const { messages, resume, analysis } = JSON.parse(event.body);
    if (!messages) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Messages required' }) };

    let systemPrompt = `You are iScanResume's AI career coach — an expert recruiter, hiring manager, and career advisor with 15 years of experience at top companies. Help candidates improve their resumes, prepare for interviews, and navigate their job search.

Be specific, actionable, direct, and encouraging. Use bullet points for lists. Keep responses focused and concise (under 200 words unless detail is truly needed).`;

    if (resume) {
      systemPrompt += `\n\nCandidate's resume:\n${resume.slice(0, 3000)}`;
    }

    if (analysis) {
      systemPrompt += `\n\nLatest ATS analysis: Score ${analysis.atsScore}/100. Key issues: ${
        (analysis.feedback || []).filter(f => f.type === 'error').map(f => f.title).join('; ')
      }. Missing keywords: ${(analysis.missing || []).slice(0, 8).join(', ')}.`;
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
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const result = data.content.map(b => b.text || '').join('');
    return { statusCode: 200, headers, body: JSON.stringify({ result }) };
  } catch (err) {
    console.error('chat error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
