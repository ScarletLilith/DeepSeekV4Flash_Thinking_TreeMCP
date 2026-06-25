import { NodeStore, extractConclusion } from "../src/nodeStore";
import { Gatekeeper } from "../src/gatekeeper";
import { StrategyEngine } from "../src/strategyEngine";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}

function main() {
  // ─── extractConclusion ─────────────────────────────────────────
  const withTag = `[分析过程]\n第一步...\n\n[最终结论]\n最终答案是 42。`;
  assert(extractConclusion(withTag) === "最终答案是 42。", "tag extraction");

  const withoutTag = "段落A\n\n段落B\n\n最终段落C。";
  assert(extractConclusion(withoutTag) === "最终段落C。", "fallback to last paragraph");

  const single = "只有一句话。";
  assert(extractConclusion(single) === "只有一句话。", "single paragraph fallback");

  // ─── NodeStore ─────────────────────────────────────────────────
  const store = new NodeStore();
  const node = store.addNode("sess_1", "trunk", "drill_down", "a".repeat(35), withTag);
  assert(node.session_id === "sess_1", "session_id");
  assert(node.conclusion === "最终答案是 42。", "stored conclusion");
  assert(store.getNodeCount("sess_1") === 1, "node count");
  assert(store.getNode("sess_1", node.node_id)?.raw_process === withTag, "raw retrieval");

  // ─── Gatekeeper ────────────────────────────────────────────────
  const gate = new Gatekeeper(store, { maxNodesPerSession: 2, minInputTextLength: 30, forbiddenKeywords: [] });
  assert(gate.validateCreate({ session_id: "sess_1", input_text: "a".repeat(35), call_type: "drill_down", parent_node_id: "trunk" }).valid, "valid input");
  assert(!gate.validateCreate({ session_id: "sess_1", input_text: "short", call_type: "drill_down", parent_node_id: "trunk" }).valid, "too short");
  store.addNode("sess_quota", "trunk", "explore", "b".repeat(35), "x");
  store.addNode("sess_quota", "trunk", "explore", "c".repeat(35), "y");
  const fullGate = new Gatekeeper(store, { maxNodesPerSession: 2, minInputTextLength: 30, forbiddenKeywords: [] });
  assert(!fullGate.validateCreate({ session_id: "sess_quota", input_text: "d".repeat(35), call_type: "drill_down", parent_node_id: "trunk" }).valid, "quota exceeded");

  // ─── StrategyEngine ────────────────────────────────────────────
  assert(StrategyEngine.getParams("verify").temperature === 0.0, "verify temp");
  assert(StrategyEngine.getParams("explore").temperature === 1.0, "explore temp");
  assert(StrategyEngine.getParams("unknown").temperature === 0.2, "default temp");

  console.log("All branch unit tests passed.");
}

main();
