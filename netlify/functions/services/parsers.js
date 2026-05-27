function safeJsonExtract(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("AI did not return JSON");
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

module.exports = { safeJsonExtract };
