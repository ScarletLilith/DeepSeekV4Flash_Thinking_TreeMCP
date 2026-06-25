/**
 * Trunk-Branch 集成测试 + 完整结果留档
 *
 * 保存到 results/ 目录：
 *   - .json: 完整结构化数据（时间线、API 调用、节点树）
 *   - .md:   可读的时间线报告
 *
 * 时间线记录：
 *   T0  会话开始
 *   T1  create_branch 调用（含 input_text）
 *   T2  API 请求发送
 *   T3  API 响应接收
 *   T4  create_branch 返回（conclusion）
 *   T5  get_branch_details 调用
 *   T6  get_branch_details 返回（raw_process）
 *   T7  会话结束 + 节点摘要
 */
import "../src/polyfill";
import * as fs from "fs";
import * as path from "path";
import { nodeStore } from "../src/nodeStore";
import {
  handleCreateBranchCall,
  handleGetBranchDetailsCall,
} from "../src/chatAgentTool";

// ─── 配置 ──────────────────────────────────────────────────────
const RESULTS_DIR = path.join(__dirname, "..", "results");
const SESSION_ID = `branch_test_${formatTimestampCompact()}`;
const BP_PATH = path.join(__dirname, "..", "blueprint.md");

interface TimelineEntry {
  t: string;       // 时间点标签 T0..T7
  timestamp: string; // ISO 时间
  event: string;
  data: any;
}

const timeline: TimelineEntry[] = [];

function record(t: string, event: string, data: any = {}) {
  timeline.push({ t, timestamp: new Date().toISOString(), event, data });
}

function formatTimestampCompact(): string {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function pad(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

function truncate(s: string, max: number): string {
  if (!s) return "";
  return s.length > max ? s.substring(0, max) + "..." : s;
}

// ─── 保存结果 ──────────────────────────────────────────────────
function saveResults(
  blueprintContent: string,
  subTask: string,
  createData: any,
  detailData: any,
  durations: { create: number; detail: number }
) {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = `branch-test-${timestamp}`;

  // ── 1. JSON (完整结构化数据) ──
  const allNodes = nodeStore.listSessionNodes(SESSION_ID);
  const jsonRecord = {
    test_name: "Trunk-Branch 集成测试：对 blueprint.md 做分析改进",
    session_id: SESSION_ID,
    timestamp: new Date().toISOString(),
    blueprint: {
      path: "blueprint.md",
      length: blueprintContent.length,
    },
    sub_task: {
      text: subTask,
      length: subTask.length,
      call_type: "explore",
    },
    timeline,
    results: {
      create_branch: {
        node_id: createData.node_id,
        conclusion: createData.conclusion,
        conclusion_length: createData.conclusion.length,
        confidence: createData.confidence,
        duration_seconds: durations.create,
      },
      get_branch_details: {
        node_id: detailData.node_id,
        raw_process: detailData.raw_process,
        raw_process_length: detailData.raw_process.length,
        duration_seconds: durations.detail,
      },
    },
    node_tree: {
      total_nodes: allNodes.length,
      nodes: allNodes.map((n) => ({
        node_id: n.node_id,
        session_id: n.session_id,
        parent_node_id: n.parent_node_id,
        call_type: n.call_type,
        input_text_length: n.input_text.length,
        conclusion_length: n.conclusion.length,
        raw_process_length: n.raw_process.length,
        created_at: n.created_at,
      })),
    },
    analysis: {
      context_compression_ratio: (
        (createData.conclusion.length / Math.max(1, detailData.raw_process.length)) *
        100
      ).toFixed(1),
      protocol_isolation: !(
        createData.conclusion.includes("[分析过程]") ||
        createData.conclusion.includes("[最终结论]") ||
        createData.conclusion.includes("分析过程")
      ),
    },
  };

  const jsonFile = path.join(RESULTS_DIR, `${baseName}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify(jsonRecord, null, 2));
  console.log(`[保存] JSON: ${jsonFile}`);

  // ── 2. Markdown (可读时间线报告) ──
  let md = "";

  // 标题
  md += `# Trunk-Branch 集成测试报告\n\n`;
  md += `**Session:** \`${SESSION_ID}\`  `;
  md += `**时间:** ${new Date().toISOString()}  \n`;
  md += `**测试内容:** 对 \`blueprint.md\` 做发散分析改进  \n`;
  md += `**调用类型:** \`explore\`\n\n`;
  md += `---\n\n`;

  // 时间线
  md += `## 时间线\n\n`;
  md += `| 标签 | 时间 | 事件 |\n`;
  md += `|------|------|------|\n`;
  for (const entry of timeline) {
    md += `| ${entry.t} | ${entry.timestamp} | ${entry.event} |\n`;
  }
  md += `\n`;

  // T1: 子问题
  md += `## T1 — 子问题输入 (input_text)\n\n`;
  md += `\`\`\`\n${subTask}\n\`\`\`\n\n`;
  md += `**长度:** ${subTask.length} 字符  \n\n`;
  md += `---\n\n`;

  // T2-T3: API 调用 (从 stderr logger 输出可见，这里记录元数据)
  md += `## T2-T3 — API 调用\n\n`;
  md += `- **模型:** deepseek-ai/DeepSeek-V4-Flash\n`;
  md += `- **Endpoint:** \`/chat/completions\`\n`;
  md += `- **Temperature:** 1.0 (explore 模式)\n`;
  md += `- **Top_P:** 0.9\n`;
  md += `- **Max_Tokens:** 2048\n`;
  md += `- **耗时:** ${durations.create}s\n\n`;
  md += `---\n\n`;

  // T4: create_branch 返回
  md += `## T4 — create_branch 返回 (结论)\n\n`;
  md += `**节点ID:** \`${createData.node_id}\`  \n`;
  md += `**结论长度:** ${createData.conclusion.length} 字符  \n\n`;
  md += `\`\`\`\n${createData.conclusion}\n\`\`\`\n\n`;
  md += `---\n\n`;

  // T5-T6: get_branch_details
  md += `## T5-T6 — get_branch_details (原始推理过程)\n\n`;
  md += `**节点ID:** \`${detailData.node_id}\`  \n`;
  md += `**原始过程长度:** ${detailData.raw_process.length} 字符  \n`;
  md += `**耗时:** ${durations.detail}s  \n\n`;
  md += `<details>\n<summary>点击展开完整推理过程 (${detailData.raw_process.length} 字符)</summary>\n\n`;
  md += `\`\`\`\n${detailData.raw_process}\n\`\`\`\n\n`;
  md += `</details>\n\n`;
  md += `---\n\n`;

  // T7: 分析总结
  md += `## T7 — 分析总结\n\n`;

  // 上下文压缩率
  const ratio = (
    (createData.conclusion.length / Math.max(1, detailData.raw_process.length)) *
    100
  ).toFixed(1);
  md += `### 上下文压缩率\n\n`;
  md += `| 指标 | 值 |\n`;
  md += `|------|:---:|\n`;
  md += `| 结论长度 | ${createData.conclusion.length} 字符 |\n`;
  md += `| 原始过程长度 | ${detailData.raw_process.length} 字符 |\n`;
  md += `| 压缩率 | ${ratio}% |\n`;
  md += `| 协议隔离 | ${
    createData.conclusion.includes("[分析过程]") ||
    createData.conclusion.includes("[最终结论]")
      ? "❌ 失败（混入过程标记）"
      : "✅ 通过"
  } |\n\n`;

  // 节点树
  md += `### 节点树\n\n`;
  md += `| 节点ID | 类型 | 父节点 | input_text | conclusion | raw_process |\n`;
  md += `|--------|:----:|:------:|:----------:|:----------:|:-----------:|\n`;
  for (const n of allNodes) {
    md += `| \`${n.node_id}\` | ${n.call_type} | ${n.parent_node_id} | ${n.input_text.length}ch | ${n.conclusion.length}ch | ${n.raw_process.length}ch |\n`;
  }
  md += `\n`;

  // 性能摘要
  md += `### 性能摘要\n\n`;
  md += `| 指标 | 值 |\n`;
  md += `|------|:---:|\n`;
  md += `| create_branch 耗时 | ${durations.create}s |\n`;
  md += `| get_branch_details 耗时 | ${durations.detail}s |\n`;
  md += `| 总耗时 | ${(durations.create + durations.detail).toFixed(1)}s |\n`;
  md += `| 会话节点数 | ${allNodes.length} |\n\n`;

  const mdFile = path.join(RESULTS_DIR, `${baseName}.md`);
  fs.writeFileSync(mdFile, md);
  console.log(`[保存] Markdown: ${mdFile}`);

  return { jsonFile, mdFile };
}

// ─── 主流程 ────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(60));
  console.log("  Trunk-Branch 集成测试");
  console.log(`  Session: ${SESSION_ID}`);
  console.log("=".repeat(60));

  record("T0", "会话开始", { session_id: SESSION_ID });

  // 1. 读取蓝图
  const blueprintContent = fs.readFileSync(BP_PATH, "utf-8");
  record("T0", "蓝图读取", { path: BP_PATH, length: blueprintContent.length });
  console.log(`\n[T0] 蓝图读取: ${blueprintContent.length} 字符`);

  // 2. create_branch
  const subTask = `我是思考模型（树干）。我正在审阅一个MCP项目的蓝图文档。以下是从蓝图中提取的关键背景：

项目名称：Thinking Agent MCP
核心功能：通过MCP Server暴露chat_agent工具，让思考模型外包子任务给非思考模型
架构模式：思考模型(主干) -> 构建自包含input_text -> chat_agent(分支)独立执行
关键技术：SiliconFlow API (OpenAI兼容)、DeepSeek-V4-Flash模型、参数控制(temperature/top_p/seed)
核心约束：无状态设计、上下文隔离、API级max_tokens控制、错误分类体系

请作为外部思维节点帮我做一次"发散探索"分析：
针对该项目的"上下文爆炸控制"和"参数协同策略"两个方面，提出具体的改进建议。

要求：
1. 每个建议说明：现状 -> 改进方案 -> 预期收益
2. 至少3条具体建议
3. 用结构化Markdown格式呈现`;

  record("T1", "create_branch 调用", {
    input_text_length: subTask.length,
    call_type: "explore",
    parent_node_id: "trunk",
  });
  console.log(`\n[T1] create_branch 调用: ${subTask.length} 字符`);

  const createStart = Date.now();
  const createResult = await handleCreateBranchCall({
    session_id: SESSION_ID,
    input_text: subTask,
    call_type: "explore",
    parent_node_id: "trunk",
  });
  const createDuration = (Date.now() - createStart) / 1000;

  const createData = JSON.parse(createResult.content[0].text);
  if (createData.status !== "success") {
    console.error("[✗] create_branch 失败:", createData);
    record("T4", "create_branch 失败", createData);
    process.exit(1);
  }

  record("T2-T3", "API 调用完成", {
    duration_seconds: createDuration,
    model: "deepseek-ai/DeepSeek-V4-Flash",
  });

  record("T4", "create_branch 返回", {
    node_id: createData.node_id,
    conclusion_length: createData.conclusion.length,
    confidence: createData.confidence,
  });
  console.log(`[T4] create_branch 成功: node=${createData.node_id} conclusion=${createData.conclusion.length}ch`);

  // 3. get_branch_details
  record("T5", "get_branch_details 调用", {
    session_id: SESSION_ID,
    node_id: createData.node_id,
  });
  console.log(`\n[T5] get_branch_details 调用: node=${createData.node_id}`);

  const detailStart = Date.now();
  const detailResult = await handleGetBranchDetailsCall({
    session_id: SESSION_ID,
    node_id: createData.node_id,
  });
  const detailDuration = (Date.now() - detailStart) / 1000;

  const detailData = JSON.parse(detailResult.content[0].text);
  if (detailData.status !== "success") {
    console.error("[✗] get_branch_details 失败:", detailData);
    process.exit(1);
  }

  record("T6", "get_branch_details 返回", {
    node_id: detailData.node_id,
    raw_process_length: detailData.raw_process.length,
  });
  console.log(`[T6] get_branch_details 成功: raw_process=${detailData.raw_process.length}ch`);

  // 4. 节点摘要
  const allNodes = nodeStore.listSessionNodes(SESSION_ID);
  record("T7", "会话结束", {
    total_nodes: allNodes.length,
    nodes: allNodes.map((n) => n.node_id),
  });

  // 5. 保存结果
  console.log(`\n--- 保存结果 ---`);
  const { jsonFile, mdFile } = saveResults(
    blueprintContent,
    subTask,
    createData,
    detailData,
    { create: createDuration, detail: detailDuration }
  );

  // 6. 终端摘要
  const ratio = (
    (createData.conclusion.length / Math.max(1, detailData.raw_process.length)) *
    100
  ).toFixed(1);

  console.log(`\n${"=".repeat(60)}`);
  console.log("  测试摘要");
  console.log(`  Session: ${SESSION_ID}`);
  console.log(`  节点: ${createData.node_id} [explore]`);
  console.log(`  结论: ${createData.conclusion.length} ch  |  推理过程: ${detailData.raw_process.length} ch`);
  console.log(`  压缩率: ${ratio}%`);
  console.log(`  结果文件:`);
  console.log(`    JSON: ${path.basename(jsonFile)}`);
  console.log(`    MD:   ${path.basename(mdFile)}`);
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
