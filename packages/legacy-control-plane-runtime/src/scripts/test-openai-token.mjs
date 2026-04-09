import "dotenv/config";

const adminKey = process.env.CONTROL_PLANE_OPENAI_ADMIN_API_KEY;

if (!adminKey) {
  console.error("CONTROL_PLANE_OPENAI_ADMIN_API_KEY is missing.");
  process.exit(1);
}
const response = await fetch(
  "https://api.openai.com/v1/organization/projects",
  {
    headers: {
      Authorization: `Bearer ${adminKey}`,
      "Content-Type": "application/json",
    },
    method: "GET",
  },
);

const body = await response.json();

if (!response.ok) {
  console.error(`OpenAI request failed: HTTP ${response.status}`);

  if (body?.error) {
    console.error(`type=${body.error.type ?? "unknown"}`);
    console.error(`code=${body.error.code ?? "unknown"}`);
    console.error(body.error.message ?? "No error message returned.");
  } else {
    console.error(JSON.stringify(body, null, 2));
  }

  process.exit(1);
}

const projects = Array.isArray(body?.data) ? body.data : [];

console.info("OpenAI admin request succeeded.");
console.info(`projects=${projects.length}`);
