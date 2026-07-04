// Vercel serverless entry point. The Express app in ../server.js already behaves as a plain
// (req, res) request handler, so it can be re-exported directly — no separate routing layer needed.
import app from "../server.js";

export default app;
