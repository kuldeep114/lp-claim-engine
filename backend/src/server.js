require("dotenv").config();
const app = require("./app");
const { initSchema } = require("./db");

const PORT = process.env.PORT || 4000;

async function main() {
  await initSchema();
  app.listen(PORT, () => {
    console.log(`Claims Intelligence Engine API listening on http://localhost:${PORT}`);
    console.log(`LLM_PROVIDER=${process.env.LLM_PROVIDER || "mock"}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
