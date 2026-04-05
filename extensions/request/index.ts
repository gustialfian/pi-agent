import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  registerSessionStart,
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
  // Register session start handler to restore cwd
  registerSessionStart(pi);

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
