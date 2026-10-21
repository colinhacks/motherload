// Vitest runs the ES module test through motherload/vite; `globals` gives it Jest's test and expect.
import motherload from "motherload/vite";

export default { plugins: [motherload()], test: { include: ["data.test.mjs"], globals: true } };
