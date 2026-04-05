import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setSessionCwd } from "./lib";
import {
  registerReqLog,
  registerReqList,
  registerReqAnalyze,
  registerReqPlan,
  registerReqImpl,
  registerReqStatus,
  registerReqDone,
  registerReq,
  registerMessageRenderer,
} from "./commands";

export default function (pi: ExtensionAPI) {
  // Set session cwd on startup
  pi.on("session_start", async (_event, ctx) => {
    setSessionCwd(ctx.cwd);
  });

  // Register message renderer and commands
  registerMessageRenderer(pi);
  registerReqLog(pi);
  registerReqList(pi);
  registerReqAnalyze(pi);
  registerReqPlan(pi);
  registerReqImpl(pi);
  registerReqStatus(pi);
  registerReqDone(pi);
  registerReq(pi);
}
