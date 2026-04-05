import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setSessionCwd } from "./lib";
import { registerCommands, registerMessageRenderer } from "./commands";

export default function (pi: ExtensionAPI) {
  // Set session cwd on startup
  pi.on("session_start", async (_event, ctx) => {
    setSessionCwd(ctx.cwd);
  });

  // Register message renderer and commands
  registerMessageRenderer(pi);
  registerCommands(pi);
}
