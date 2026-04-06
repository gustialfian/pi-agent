import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  registerReq,
  registerMessageRenderer,
} from "./commands";

export default function (pi: ExtensionAPI) {
  registerMessageRenderer(pi);
  registerReq(pi);
}
