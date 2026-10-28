import { defineConfig } from "vitest/config";

// Unit-test real authenticated handlers without TanStack's RPC transform or a
// live database. The application build keeps its existing Vite configuration.
export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: {
    environment: "node",
    include: ["src/lib/notifications.test.ts", "src/lib/notifications.functions.test.ts"],
  },
});