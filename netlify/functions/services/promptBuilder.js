
function buildPrompt(type, payload) {
  switch (type) {

    case "analyze":
      return `
You are an ATS resume analyser. Return ONLY valid JSON.

Resume:
${payload.resume?.slice(0, 4000)}
`;

    case "chat":
      return `
You are a career coach.

Resume:
${payload.resume || ""}

User message:
${payload.message}
`;

    case "match":
      return `
Compare resume vs job description.

Resume:
${payload.resume}

Job:
${payload.jobDesc}
`;

    case "interview":
      return `
You are a senior technical interviewer.

Role: ${payload.role}

Resume:
${payload.resume}

Types: ${payload.types?.join(", ")}
`;

    case "rewrite":
      return `
Rewrite this resume bullet:

${payload.bullet}
`;

    default:
      throw new Error("Unknown type: " + type);
  }
}

module.exports = { buildPrompt };
