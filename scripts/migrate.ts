import { createNodeDatabase } from "@lablens/data/node";

const dbPath = process.env.LABLENS_DB ?? "./data/lablens.db";

const handle = createNodeDatabase(dbPath);
handle.connection.close();

console.log(`Applied migrations to ${dbPath}`);
