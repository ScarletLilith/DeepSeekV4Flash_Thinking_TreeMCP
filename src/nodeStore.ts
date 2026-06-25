import { randomUUID } from "crypto";
import type { BranchNode } from "./schemas";

/**
 * 节点存储与结论提取中心。
 *
 * 内存结构：{ session_id: { node_id: BranchNode } }
 * 核心约束：绝不使用 text[:N] 硬截断语义文本。
 */
export class NodeStore {
  private _store: Map<string, Map<string, BranchNode>> = new Map();

  addNode(
    sessionId: string,
    parentNodeId: string,
    callType: string,
    inputText: string,
    rawResponse: string
  ): BranchNode {
    if (!this._store.has(sessionId)) {
      this._store.set(sessionId, new Map());
    }

    const session = this._store.get(sessionId)!;
    const nodeId = `n_${randomUUID().replace(/-/g, "").slice(0, 8)}`;

    const node: BranchNode = {
      node_id: nodeId,
      session_id: sessionId,
      parent_node_id: parentNodeId,
      call_type: callType,
      input_text: inputText,
      conclusion: extractConclusion(rawResponse),
      raw_process: rawResponse,
      confidence: null,
      created_at: new Date().toISOString(),
    };

    session.set(nodeId, node);
    return node;
  }

  getNode(sessionId: string, nodeId: string): BranchNode | undefined {
    return this._store.get(sessionId)?.get(nodeId);
  }

  getNodeCount(sessionId: string): number {
    return this._store.get(sessionId)?.size ?? 0;
  }

  listSessionNodes(sessionId: string): BranchNode[] {
    const session = this._store.get(sessionId);
    if (!session) return [];
    return Array.from(session.values()).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }
}

/**
 * 从模型原始输出中提取结论。
 *
 * 策略：
 * 1. 优先匹配 [最终结论] / 【最终结论】 标签后的全部内容。
 * 2. 若未命中标签，取最后一个非空自然段。
 * 3. 极端情况下全量返回原始文本。
 * 全程不使用字符长度硬截断。
 */
export function extractConclusion(text: string): string {
  const conclusionPattern = /(?:\[最终结论\]|【最终结论】)\s*([\s\S]*)/i;
  const match = conclusionPattern.exec(text);
  if (match) {
    return match[1].trim();
  }

  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length > 1) {
    return paragraphs[paragraphs.length - 1];
  }

  return text.trim();
}

export const nodeStore = new NodeStore();
