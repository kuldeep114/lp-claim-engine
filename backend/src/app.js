const express = require("express");
const cors = require("cors");
const claimsRouter = require("./routes/claims");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/api", claimsRouter);

// Centralized error handler: any route that throws (or forgets to catch a
// rejected promise) ends up here instead of taking the process down or
// hanging the request.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
