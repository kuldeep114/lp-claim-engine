const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");

const SCHEMA_PATH = path.join(__dirname, "schema.sql");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initSchema() {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  await pool.query(schema);
}

module.exports = { pool, initSchema };
