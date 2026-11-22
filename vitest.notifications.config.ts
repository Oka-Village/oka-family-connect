import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

// Unit-test real authenticated handlers without TanStack's RPC transform or a
// live database. The application build keeps its existing Vite configuration.
export default defineConfig({
  resolve: { alias: { "@": path.join(root, "src") } },
  test: {
    environment: "node",
    include: ["src/lib/notifications.test.ts", "src/lib/notifications.functions.test.ts"],
  },
});
