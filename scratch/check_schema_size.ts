import nodeRegistry from "./src/lib/nodeRegistry";

const out: Record<string, unknown> = {};
for (const [type, exec] of Object.entries(nodeRegistry)) {
  out[type] = exec.schema;
}
const schema = JSON.stringify(out, null, 2);
console.log(`Schema length: ${schema.length} characters`);
console.log(`Estimated tokens (char/4): ${schema.length / 4}`);
