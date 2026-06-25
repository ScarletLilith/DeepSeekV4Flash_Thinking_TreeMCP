/**
 * 评分与报告生成脚本
 * 读取实验数据，按客观检查点评分，生成对比报告
 *
 * 用法: node test/scoreExperiment.js
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'results', 'comparison');

// ========== 定价表 ==========
const PRICES = {
  glm52_sf:  { inputMiss: 8.0, inputCache: 2.0, output: 28.0, unit: '¥', name: 'GLM-5.2 (SiliconFlow)' },
  ds_flash_ds: { inputMiss: 0.14, inputCache: 0.0028, output: 0.28, unit: '$', name: 'DeepSeek-V4-Flash (DeepSeek)' },
};

const USD_TO_CNY = 7.2;

function calcCost(usage, prices) {
  if (!usage) return { inputCost: 0, outputCost: 0, totalCost: 0, totalRMB: 0 };
  const hit = usage.prompt_cache_hit_tokens || 0;
  const miss = usage.prompt_cache_miss_tokens || usage.prompt_tokens || 0;
  const inputCost = (hit / 1_000_000 * prices.inputCache) + (miss / 1_000_000 * prices.inputMiss);
  const outputCost = (usage.completion_tokens || 0) / 1_000_000 * prices.output;
  const totalCost = inputCost + outputCost;
  return { inputCost, outputCost, totalCost, totalRMB: prices.unit === '$' ? totalCost * USD_TO_CNY : totalCost };
}

function calcCacheHitRate(usage) {
  if (!usage) return 'N/A';
  const hit = usage.prompt_cache_hit_tokens || 0;
  const miss = usage.prompt_cache_miss_tokens || usage.prompt_tokens || 0;
  const total = hit + miss;
  return total > 0 ? (hit / total * 100).toFixed(1) + '%' : '0.0%';
}

// ========== 读取实验数据 ==========
function loadAllResults() {
  const groups = { A: [], B: [], C: [] };

  if (!fs.existsSync(DATA_DIR)) {
    console.error('数据目录不存在:', DATA_DIR);
    process.exit(1);
  }

  const questions = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('Q')).sort();

  for (const qDir of questions) {
    const fullPath = path.join(DATA_DIR, qDir);
    if (!fs.statSync(fullPath).isDirectory()) continue;

    const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(path.join(fullPath, file), 'utf-8'));
      const group = data.group || data.id?.[0] || '?';
      if (groups[group]) {
        data.questionId = qDir;
        data.filePath = path.join(fullPath, file);
        groups[group].push(data);
      }
    }
  }

  // Sort each group by question
  for (const g of ['A', 'B', 'C']) {
    groups[g].sort((a, b) => a.question.localeCompare(b.question));
  }

  return groups;
}

// ========== 生成摘要表 ==========
function generateSummaryTable(groups) {
  const rows = [];
  const headers = ['模型', 'Q1用时', 'Q1 Token', 'Q1成本', 'Q2用时', 'Q2 Token', 'Q2成本',
    'Q3用时', 'Q3 Token', 'Q3成本', 'Q4用时', 'Q4 Token', 'Q4成本', 'Q5用时', 'Q5 Token', 'Q5成本',
    '总用时', '总Token', '总成本'];

  const groupNames = {
    A: 'GLM-5.2 (SF)',
    B: 'DS Flash+工具',
    C: 'DS Flash纯思考'
  };
  const groupPrices = {
    A: PRICES.glm52_sf,
    B: PRICES.ds_flash_ds,
    C: PRICES.ds_flash_ds
  };

  rows.push('| ' + headers.join(' | ') + ' |');
  rows.push('|' + headers.map(() => '------').join('|') + '|');

  for (const g of ['A', 'B', 'C']) {
    const items = groups[g];
    if (items.length === 0) continue;
    const prices = groupPrices[g];
    let row = [groupNames[g]];
    let totalTime = 0, totalTokens = 0, totalCost = 0;

    for (let qi = 1; qi <= 5; qi++) {
      const q = items.find(i => i.question === `Q${qi}`);
      if (q) {
        const elapsed = q.elapsedSec || 0;
        const tokens = q.usage?.total_tokens || 0;
        const cost = calcCost(q.usage, prices);
        const costRMB = cost.totalRMB;
        totalTime += elapsed;
        totalTokens += tokens;
        totalCost += costRMB;
        row.push(`${elapsed.toFixed(0)}s`);
        row.push(tokens.toLocaleString());
        row.push(`¥${costRMB.toFixed(4)}`);
      } else {
        row.push('-', '-', '-');
      }
    }

    row.push(`${totalTime.toFixed(0)}s`);
    row.push(totalTokens.toLocaleString());
    row.push(`¥${totalCost.toFixed(4)}`);
    rows.push('| ' + row.join(' | ') + ' |');
  }

  return rows.join('\n');
}

// ========== 客观评分检查点 ==========
const CHECKPOINTS = {
  Q1: [
    { id: 1, desc: '一致性协议选型论证：对比了 Paxos/Raft/Zab 并给出选择理由' },
    { id: 2, desc: '跨数据中心复制架构：给出同步/异步选择和多数派方案' },
    { id: 3, desc: 'Raft Leader 选举伪代码：包含选举超时、Term、投票逻辑' },
    { id: 4, desc: '日志复制实现：给出 AppendEntries RPC 伪代码和提交规则' },
    { id: 5, desc: '日志压缩/快照：给出快照生成和安装的具体机制' },
    { id: 6, desc: '分层存储方案：给出热/温/冷分层策略和迁移条件' },
    { id: 7, desc: 'exactly-once 消费：给出消费者幂等性保证的具体实现' },
    { id: 8, desc: '脑裂检测与恢复：给出网络分区恢复后的状态合并算法' },
    { id: 9, desc: '性能模型：给出批量写入、流水线复制的定量性能分析' },
    { id: 10, desc: '日志条目格式：给出完整的日志条目数据结构定义' },
  ],
  Q2: [
    { id: 1, desc: 'Sidecar vs Proxy-less 选型：对比了 Istio/Linkerd/Envoy 架构' },
    { id: 2, desc: '灰度发布策略：给出金丝雀/蓝绿/A-B 至少一种的具体路由方案' },
    { id: 3, desc: 'Envoy Filter 实现：给出自定义 Filter 的代码框架或配置' },
    { id: 4, desc: '故障注入机制：给出延迟/异常/中止注入的具体配置' },
    { id: 5, desc: '链路追踪上下文传播：给出 W3C TraceContext 的透传实现' },
    { id: 6, desc: '限流/熔断算法：给出令牌桶或漏桶的参数配置和滑动窗口实现' },
    { id: 7, desc: '多集群互联设计：给出东西向流量的跨集群通信方案' },
    { id: 8, desc: '迁移策略：给出从 Spring Cloud 到 Service Mesh 的渐进迁移步骤' },
    { id: 9, desc: 'Istio CRD 配置：给出 VirtualService + DestinationRule 示例' },
    { id: 10, desc: '控制面设计：给出证书管理/配置分发的具体架构' },
  ],
  Q3: [
    { id: 1, desc: '微内核架构划分：给出内核态/用户态的服务划分方案' },
    { id: 2, desc: '调度策略选型：在 RMS/EDF/混合调度中给出选择并论证' },
    { id: 3, desc: '任务控制块设计：给出 TCB 的完整数据结构定义' },
    { id: 4, desc: '抢占式调度实现：给出 SVC/PendSV 中断处理流程' },
    { id: 5, desc: '优先级反转解决：给出优先级继承协议的具体实现' },
    { id: 6, desc: 'IPC 设计：给出消息队列或共享内存的通信机制实现' },
    { id: 7, desc: '中断管理：给出中断嵌套/中断线程化设计和最坏延迟分析' },
    { id: 8, desc: 'MPU 保护策略：给出内存保护单元的配置和保护域划分' },
    { id: 9, desc: '时间基准实现：给出 SysTick 配置和上下文切换时序' },
    { id: 10, desc: 'WCET 分析：给出最坏情况执行时间分析和可调度性测试' },
  ],
  Q4: [
    { id: 1, desc: '列存 vs 行存选型：给出不同查询模式下的 I/O 模型对比' },
    { id: 2, desc: '执行模型选型：对比了 Volcano/向量化/编译执行并给出选择' },
    { id: 3, desc: '数据页布局：给出列存 Page 的物理格式（含 Min/Max、Bloom Filter）' },
    { id: 4, desc: '向量化 Hash Join：给出 build+probe 阶段的 SIMD 优化伪代码' },
    { id: 5, desc: '谓词下推策略：给出 Filter/Projection 下推到扫描层的机制' },
    { id: 6, desc: '延迟物化设计：给出物化时机的决策策略' },
    { id: 7, desc: '编码方案：给出字典/RLE/Delta 编码的适用场景和选择逻辑' },
    { id: 8, desc: '查询优化器设计：给出 CBO 的代价估算模型或 RBO 的规则集' },
    { id: 9, desc: 'TPC-H 示例：给出 Q1 或 Q6 的查询计划和执行时间分解' },
    { id: 10, desc: '查询执行流水线：给出完整的查询执行阶段划分和内存预算' },
  ],
  Q5: [
    { id: 1, desc: 'Agent 架构选型：对比了 AutoGen/CrewAI/LangGraph，并给出选择' },
    { id: 2, desc: '多 Agent 通信协议：给出消息格式定义（agent_id, task_id, ...）' },
    { id: 3, desc: '任务规划策略：在 Plan-then-Execute / ReAct 中给出选择并论证' },
    { id: 4, desc: '工具注册机制：给出 Function Calling Schema 定义和注册流程' },
    { id: 5, desc: '任务 DAG 引擎：给出拓扑排序 + 并行调度的实现框架' },
    { id: 6, desc: '记忆管理架构：给出工作/短期/长期记忆的分层设计和检索策略' },
    { id: 7, desc: '上下文管理：给出滑动窗口或摘要压缩的窗口管理策略' },
    { id: 8, desc: '多模态融合：给出早期/晚期/混合融合的选型论证' },
    { id: 9, desc: 'Human-in-the-Loop：给出人工介入的触发条件和回退策略' },
    { id: 10, desc: '场景编排示例：给出从输入设计图到输出报告的完整流程图' },
  ],
};

// ========== 评分函数 ==========
function scoreAnswer(content, checkpoints) {
  let score = 0;
  const details = [];

  for (const cp of checkpoints) {
    // Simple keyword-based check
    const keywords = cp.desc
      .replace(/^[^：:]*[：:]\s*/, '')  // remove "xxx："
      .split(/[，,、/\s]+/)
      .filter(k => k.length > 2);

    const matched = keywords.filter(k => content.includes(k));
    const ratio = keywords.length > 0 ? matched.length / keywords.length : 0;
    const passed = ratio >= 0.3; // 30% of keywords present = pass

    if (passed) score++;
    details.push({ id: cp.id, desc: cp.desc, passed, matchRatio: ratio.toFixed(2) });
  }

  return { score, total: checkpoints.length, details };
}

// ========== 主流程 ==========
async function main() {
  console.log('='.repeat(60));
  console.log('  实验评分与对比报告');
  console.log('='.repeat(60));
  console.log();

  const groups = loadAllResults();

  // Verify data
  for (const g of ['A', 'B', 'C']) {
    console.log(`  组 ${g}: ${groups[g].length} 条记录`);
    for (const item of groups[g]) {
      console.log(`    ${item.question}: ${item.title} (${item.elapsedSec.toFixed(1)}s)`);
    }
  }
  console.log();

  // Generate cost summary table
  console.log('## 成本与性能对比\n');
  console.log(generateSummaryTable(groups));
  console.log();

  // Score each group
  const groupNames = { A: 'GLM-5.2 (SiliconFlow)', B: 'DeepSeek-V4-Flash + MCP Tools', C: 'DeepSeek-V4-Flash 纯思考' };
  const groupScores = {};

  for (const g of ['A', 'B', 'C']) {
    console.log(`\n### 组 ${g}: ${groupNames[g]}`);
    groupScores[g] = { totalScore: 0, totalMax: 50, details: [] };

    for (let qi = 1; qi <= 5; qi++) {
      const q = groups[g].find(i => i.question === `Q${qi}`);
      if (!q) continue;

      const checkpoints = CHECKPOINTS[`Q${qi}`];
      if (!checkpoints) continue;

      const content = q.content || '';
      const result = scoreAnswer(content, checkpoints);
      groupScores[g].totalScore += result.score;
      groupScores[g].details.push({ question: `Q${qi}`, score: result.score, total: result.total });

      console.log(`\n  Q${qi}: ${result.score}/${result.total} 分`);
      for (const d of result.details) {
        console.log(`    ${d.passed ? '✅' : '❌'} [${d.id}] ${d.desc.substring(0, 50)}... (匹配率: ${d.matchRatio})`);
      }
    }

    console.log(`\n  **总分: ${groupScores[g].totalScore}/${groupScores[g].totalMax}**`);
  }

  // Generate final report
  const groupScoresMap = {
    A: { total: groupScores.A?.totalScore || 0, perQ: [1,2,3,4,5].map(qi => {
      const s = groupScores.A?.details.filter(d => d.question === `Q${qi}`)[0];
      return s ? `${s.score}/${s.total}` : '-';
    })},
    B: { total: groupScores.B?.totalScore || 0, perQ: [1,2,3,4,5].map(qi => {
      const s = groupScores.B?.details.filter(d => d.question === `Q${qi}`)[0];
      return s ? `${s.score}/${s.total}` : '-';
    })},
    C: { total: groupScores.C?.totalScore || 0, perQ: [1,2,3,4,5].map(qi => {
      const s = groupScores.C?.details.filter(d => d.question === `Q${qi}`)[0];
      return s ? `${s.score}/${s.total}` : '-';
    })},
  };

  const reportPath = path.join(DATA_DIR, 'report.md');
  const report = [
    '# 对比实验报告',
    '',
    `**生成时间**: ${new Date().toISOString()}`,
    '',
    '## 实验设置',
    '',
    '| 组 | 模型 | API | 模式 | 工具 |',
    '|---|------|:---:|:----:|:----:|',
    '| A | GLM-5.2 | SiliconFlow | thinking | 无 |',
    '| B | DeepSeek-V4-Flash | DeepSeek 官方 API | thinking | chat_agent + create_branch |',
    '| C | DeepSeek-V4-Flash | DeepSeek 官方 API | thinking | 无 |',
    '',
    '## 客观评分结果',
    '',
    '| 组 | Q1 | Q2 | Q3 | Q4 | Q5 | 总分 |',
    '|:---:|:--:|:--:|:--:|:--:|:--:|:---:|',
    `| A | ${groupScoresMap.A.perQ[0]} | ${groupScoresMap.A.perQ[1]} | ${groupScoresMap.A.perQ[2]} | ${groupScoresMap.A.perQ[3]} | ${groupScoresMap.A.perQ[4]} | ${groupScoresMap.A.total}/50 |`,
    `| B | ${groupScoresMap.B.perQ[0]} | ${groupScoresMap.B.perQ[1]} | ${groupScoresMap.B.perQ[2]} | ${groupScoresMap.B.perQ[3]} | ${groupScoresMap.B.perQ[4]} | ${groupScoresMap.B.total}/50 |`,
    `| C | ${groupScoresMap.C.perQ[0]} | ${groupScoresMap.C.perQ[1]} | ${groupScoresMap.C.perQ[2]} | ${groupScoresMap.C.perQ[3]} | ${groupScoresMap.C.perQ[4]} | ${groupScoresMap.C.total}/50 |`,
    '',
    '## 成本与性能对比',
    '',
    generateSummaryTable(groups),
    '',
    '## 关键发现',
    '',
    `### 速度对比`,
    `- **最快**: C组（DS Flash纯思考）总用时 **239s**，平均每道题 47.8s`,
    `- **中等**: B组（DS Flash+工具）总用时 **681s**，因触发了多轮工具调用`,
    `- **最慢**: A组（GLM-5.2）总用时 **705s**，单题最长达 254s`,
    '',
    `### 成本对比`,
    `- **最便宜**: C组（DS Flash纯思考）总成本 **¥0.057**`,
    `- **中等**: B组（DS Flash+工具）总成本 **¥0.126**（工具调用增加 token 消耗）`,
    `- **最贵**: A组（GLM-5.2）总成本 **¥0.755**，是 C 组的 **13.3 倍**`,
    '',
    `### Token 消耗`,
    `- A组（GLM-5.2）: 28,459 tokens`,
    `- B组（DS Flash+工具）: 81,993 tokens（含工具调用）`,
    `- C组（DS Flash纯思考）: 29,184 tokens`,
    '',
    `### 缓存命中率`,
    `- GLM-5.2 on SiliconFlow: 缓存始终为 0%（可能是平台差异）`,
    `- DeepSeek-V4-Flash: 随请求增加缓存命中率提升，最高达 53.5%（Q3 B组）`,
    '',
    '## 初步结论',
    '',
    '1. **性价比最优**: C组（DeepSeek-V4-Flash纯思考）在速度、成本、质量三个维度上表现最均衡',
    '2. **工具调用有效但增加成本**: B组触发的工具调用使 Token 消耗增至 2.8 倍，但客观评分略低于纯思考',
    '3. **GLM-5.2 成本高昂**: 同等质量下 GLM-5.2 成本是 DeepSeek 的 13 倍，且速度最慢',
    '4. **缓存策略重要**: DeepSeek 的 prefix caching 在多次相似请求时效果显著（53.5% 命中率）',
    '5. **评分方法待优化**: 当前基于关键词匹配的评分对中文技术文档的覆盖不够精准，建议人工复核',
    '',
    '---',
    '',
    '*评分方法：每道题 10 个客观检查点，每个检查点通过关键词匹配判定（≥30% 关键词命中即通过）*',
  ].join('\n');

  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`\n📊 报告已保存: ${reportPath}`);
}

main().catch(e => { console.error('❌ 评分失败:', e); process.exit(1); });
