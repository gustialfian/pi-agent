import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
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
