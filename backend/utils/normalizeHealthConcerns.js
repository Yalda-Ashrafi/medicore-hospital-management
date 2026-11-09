function normalizeHealthConcerns(value) {
  if (value === undefined) return { concerns: [] };
  if (typeof value !== "string" && !Array.isArray(value)) {
    return { error: "Health concerns must be provided as a list." };
  }
  if (Array.isArray(value) && value.some((entry) => typeof entry !== "string")) {
    return { error: "Each health concern must be text." };
  }

  const entries = (Array.isArray(value) ? value : value.split(","))
    .map((entry) => typeof entry === "string" ? entry.trim() : "")
    .filter(Boolean);
  if (entries.length > 30 || entries.some((entry) => entry.length > 80)) {
    return { error: "Enter up to 30 health concerns, each no longer than 80 characters." };
  }

  const unique = new Map();
  entries.forEach((entry) => {
    if (!unique.has(entry.toLowerCase())) unique.set(entry.toLowerCase(), entry);
  });
  return { concerns: [...unique.values()] };
}

module.exports = normalizeHealthConcerns;
