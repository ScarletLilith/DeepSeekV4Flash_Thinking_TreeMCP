/**
 * 对比实验自动化运行脚本
 * 运行三组（A: GLM-5.2 / B: DeepSeek+工具 / C: DeepSeek纯思考）
 * 对5道工程难题逐题调用API，记录结果
 *
 * 用法: node test/runExperiment.js
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// ========== 配置 ==========
const CFG_DIR = __dirname;
const RESULTS_DIR = path.join(__dirname, '..', 'results', 'comparison');

function loadConfig(name) {
  return JSON.parse(fs.readFileSync(path.join(CFG_DIR, name), 'utf-8'));
}

// ========== 5 道题的 Prompt ==========
const QUESTIONS = [
  {
    id: 'Q1',
    title: '分布式事务日志系统',
    prompt: `你是一位资深的分布式系统架构师。请从"设计层面"和"工程层面"两个角度，全面回答以下问题：

## 问题：构建一个高可用分布式事务日志系统

某金融科技公司需要构建一个跨数据中心的分布式事务日志系统，用于审计和故障恢复。要求日志绝对不丢失（durability）、全局有序（total order）、可回溯查询。

### 设计层面（架构决策与权衡分析）
1. 对比 Paxos、Raft、Zab 协议在这类场景下的适用性，给出选型论证
2. 设计跨数据中心日志复制架构：同步复制 vs 异步复制，多数派跨数据中心如何工作
3. 日志压缩与快照机制设计：如何在不影响有序性的前提下压缩历史日志
4. 容量规划：单日产生 10TB 日志，设计保留策略和分层存储方案（热/温/冷）
5. 一致性模型决策：线性一致性 vs 最终一致性在审计场景下的 trade-off

### 工程层面（实现细节与具体算法）
1. 给出 Raft 的 Leader 选举和日志复制的核心伪代码实现
2. 设计日志条目格式（含元数据字段），确保全局唯一性和顺序性
3. 实现日志消费者的 at-least-once / exactly-once 语义保证
4. 网络分区下的处理策略：脑裂检测和恢复的具体算法
5. 性能优化：批量写入、流水线复制、异步 fsync 的具体参数调优

请确保回答同时涵盖以上两个层面，并给出可交付的架构方案、核心伪代码和性能模型。`
  },
  {
    id: 'Q2',
    title: '微服务网格流量管理系统',
    prompt: `你是一位资深的基础设施架构师。请从"设计层面"和"工程层面"两个角度，全面回答以下问题：

## 问题：设计并实现一个微服务网格的智能流量管理系统

一个拥有 200+ 微服务的电商平台，需要引入 Service Mesh 实现流量管理、灰度发布、故障注入和全链路可观测性。当前使用 Spring Cloud，需平滑迁移。

### 设计层面（架构决策与权衡分析）
1. Sidecar Proxy 模式 vs Proxy-less 模式选型：对比 Istio/Linkerd/Envoy 的架构差异
2. 控制面设计：服务发现、配置分发、证书管理的集中式 vs 分散式设计
3. 灰度发布策略设计：金丝雀发布、蓝绿部署、A/B 测试的流量路由规则引擎
4. 多集群/多 Region 的 Mesh 互联设计：东西向流量 vs 南北向流量管理
5. 从 Spring Cloud 到 Service Mesh 的平滑迁移策略：渐进式改造方案

### 工程层面（实现细节与具体算法）
1. 给出基于 Envoy 的自定义 Filter 实现流量镜像的代码框架
2. 设计故障注入的配置格式和实现机制（延迟注入、异常注入、中止注入）
3. 实现分布式链路追踪的上下文传播（W3C TraceContext 的透传实现）
4. 设计限流/熔断的滑动窗口算法：令牌桶 vs 漏桶的参数配置和实现
5. 给出 Istio 的 VirtualService / DestinationRule CRD 配置示例（灰度发布场景）

请确保回答同时涵盖以上两个层面，并给出可交付的 Mesh 架构迁移方案、核心 Filter 实现和灰度发布配置。`
  },
  {
    id: 'Q3',
    title: '嵌入式实时操作系统微内核',
    prompt: `你是一位嵌入式系统专家。请从"设计层面"和"工程层面"两个角度，全面回答以下问题：

## 问题：为嵌入式设备设计一个实时操作系统微内核

为 IoT 边缘设备（Cortex-M4, 256KB Flash, 64KB RAM）设计一个抢占式实时操作系统微内核，需支持多任务、中断管理、内存保护。

### 设计层面（架构决策与权衡分析）
1. 微内核架构设计：内核态与用户态的划分，哪些服务放在内核态（IPC、调度）vs 用户态（文件系统、网络栈）
2. 任务调度策略设计：RMS vs EDF vs 混合调度，如何保证硬实时任务的截止时间
3. 进程间通信（IPC）设计：消息队列 vs 共享内存 vs 信号，选择依据和性能模型
4. 中断管理设计：中断嵌套、中断线程化、最坏情况中断延迟分析
5. 内存保护方案：MPU 的配置策略，如何防止用户任务破坏内核和其他任务

### 工程层面（实现细节与具体算法）
1. 给出任务控制块（TCB）的数据结构定义，以及任务创建/切换的核心代码
2. 实现抢占式调度器：SVC/PendSV 异常处理流程的汇编级伪代码
3. 实现信号量/互斥量的优先级反转解决方案（优先级继承协议）
4. 实现时间片轮转调度的时间基准（SysTick 配置和上下文切换时序）
5. 给出最坏情况执行时间（WCET）的分析方法，和调度可行性测试（schedulability test）

请确保回答同时涵盖以上两个层面，并给出可交付的微内核架构规范、核心调度器实现和 WCET 分析。`
  },
  {
    id: 'Q4',
    title: '列式存储查询引擎',
    prompt: `你是一位数据库内核专家。请从"设计层面"和"工程层面"两个角度，全面回答以下问题：

## 问题：设计并实现一个列式存储查询引擎

为分析型数据库设计一个列式存储引擎的查询执行模块，需支持 SQL 查询的向量化执行、谓词下推、延迟物化。数据量 PB 级。

### 设计层面（架构决策与权衡分析）
1. 列式存储 vs 行式存储的选择依据：不同查询模式下的 I/O 模型对比
2. 查询执行架构设计：Volcano 模型 vs 向量化模型 vs 编译执行，选型论证
3. 谓词下推策略：哪些算子可以下推（Filter、Projection、Aggregation），下推到什么层级
4. 延迟物化（Late Materialization）设计：如何确定最佳的物化时机
5. 查询优化器设计：CBO vs RBO，统计信息收集和代价模型

### 工程层面（实现细节与具体算法）
1. 给出列式存储的数据页布局设计：Min/Max 索引、Bloom Filter、字典编码
2. 实现向量化 Hash Join 的核心算法伪代码（build + probe 阶段的 SIMD 优化）
3. 实现 Page-level 的谓词下推：扫描时直接跳过不符合条件的 Page
4. 设计编码方案：字典编码、RLE、Delta 编码的适用场景选择和实现
5. 给出 TPC-H 基准测试中 Q1/Q6 的查询计划示例和执行时间分解

请确保回答同时涵盖以上两个层面，并给出可交付的存储格式规范、查询执行流水线设计和编码方案对比测试。`
  },
  {
    id: 'Q5',
    title: '多模态AI Agent编排框架',
    prompt: `你是一位 AI Agent 框架架构师。请从"设计层面"和"工程层面"两个角度，全面回答以下问题：

## 问题：构建一个多模态 AI Agent 编排框架

设计一个通用 AI Agent 编排框架，支持多模态输入（文本、图像、音频、代码）、多模型协同（不同模型负责不同子任务）、工具调用（API、数据库、文件系统）、记忆管理和人机协作。

### 设计层面（架构决策与权衡分析）
1. Agent 架构设计：单一 Agent vs 多 Agent 协作（Orchestrator + Worker 模式），对比 AutoGen / CrewAI / LangGraph 的架构差异
2. 多模态融合策略：早期融合 vs 晚期融合 vs 混合融合，选型论证
3. 任务规划与分解：Plan-then-Execute vs ReAct 循环，如何保证复杂任务的完成率
4. 记忆管理设计：工作记忆、短期记忆、长期记忆的分层架构，检索策略
5. 人机协作模式：Human-in-the-Loop 的介入时机和回退策略设计

### 工程层面（实现细节与具体算法）
1. 给出多 Agent 通信的消息协议设计（agent_id, task_id, status, payload 的格式定义）
2. 实现工具调用的注册与发现机制：OpenAI Function Calling 格式的工具描述 Schema
3. 设计任务 DAG 的执行引擎：拓扑排序 + 并行调度 + 依赖管理
4. 实现多轮对话的上下文窗口管理：滑动窗口 vs 摘要压缩 vs KV Cache 复用
5. 给出一个具体场景的 Agent 编排示例："分析一张产品设计图 → 生成代码 → 执行测试 → 输出报告" 的完整流程图

请确保回答同时涵盖以上两个层面，并给出可交付的 Agent 框架架构、消息协议定义和场景编排示例。`
  }
];

// ========== 工具定义（仅 B 组使用）==========
const TOOLS = [
  { type: 'function', function: { name: 'chat_agent', description: '调用非思考模型生成文本，用于延伸思维链。你可以传入需要独立完成的子任务。', parameters: { type: 'object', properties: { input_text: { type: 'string', description: '完整的任务描述，包含所有上下文' }, system_prompt: { type: 'string' }, temperature: { type: 'number', default: 0.7 }, top_p: { type: 'number', default: 0.9 }, max_tokens: { type: 'number', default: 4096 } }, required: ['input_text'] } } },
  { type: 'function', function: { name: 'create_branch', description: '创建思维分支节点，实现树形思维，多角度深入分析。四种类型：drill_down（深入拆解）、verify（验证结论）、explore（发散思考）、stash（记录想法）。', parameters: { type: 'object', properties: { session_id: { type: 'string', description: '会话ID' }, input_text: { type: 'string', minLength: 30, description: '完整的子任务描述' }, call_type: { type: 'string', enum: ['drill_down','verify','explore','stash'], description: '分支类型' }, parent_node_id: { type: 'string', default: 'trunk', description: '父节点ID' } }, required: ['session_id','input_text'] } } }
];

// ========== 实验组定义（仅 B 组）==========
const GROUPS = [
  {
    id: 'B',
    name: 'DeepSeek-V4-Flash + MCP Tools',
    configFile: 'config.json',
    useTools: true,
    thinkingParam: { thinking: { type: 'enabled' }, reasoning_effort: 'high' }
  }
];

// ========== API 调用（无超时，等待完成）==========
async function callAPI(config, body) {
  try {
    const resp = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { error: `HTTP ${resp.status}: ${errText.substring(0, 200)}`, statusCode: resp.status };
    }
    return await resp.json();
  } catch (err) {
    return { error: err.message };
  }
}

// ========== 工具执行（仅 B 组多轮用）==========
async function executeTool(config, toolCall) {
  const args = JSON.parse(toolCall.function.arguments);
  const tc = args;

  const body = {
    model: config.model,
    messages: tc.system_prompt
      ? [{ role: 'system', content: tc.system_prompt }, { role: 'user', content: tc.input_text }]
      : [{ role: 'user', content: tc.input_text }],
    temperature: tc.temperature || 0.7,
    max_tokens: tc.max_tokens || 4096,
    top_p: tc.top_p || 0.9,
  };

  const result = await callAPI(config, body);
  if (result.error) return JSON.stringify({ error: result.error });
  return JSON.stringify({
    success: true,
    content: result.choices?.[0]?.message?.content || '',
    usage: result.usage
  });
}

// ========== 执行单个问题 ==========
async function runQuestion(config, group, question) {
  const startTime = Date.now();
  const result = {
    group: group.id,
    question: question.id,
    title: question.title,
    startTime: new Date().toISOString(),
    rounds: 0,
    toolCalls: 0,
    elapsedSec: 0,
    content: '',
    reasoning: '',
    usage: null,
    model: '',
    cacheHitRate: '0%',
    cost: null,
    httpStatus: null,
    error: null
  };

  try {
    const body = {
      model: config.model,
      messages: [
        { role: 'system', content: `You are a world-class expert in software engineering and systems design. Answer the following question in Chinese, covering both design-level architecture decisions AND engineering-level implementation details.

When using create_branch or chat_agent: you are the Orchestrator. Tools provide material for YOUR thinking, they do NOT replace your thinking. After receiving tool results, YOU must synthesize and integrate the conclusions yourself. Do NOT delegate the integration task back to tools.` },
        { role: 'user', content: question.prompt }
      ],
      stream: false,
      max_tokens: 32768,
      ...group.thinkingParam
    };

    if (group.useTools) {
      body.tools = TOOLS;
      body.tool_choice = 'auto';
    }

    // 第一轮调用
    console.log(`  [${group.id}/${question.id}] 第1轮请求...`);
    const data = await callAPI(config, body, 600000);

    if (data.error) {
      result.error = data.error;
      result.httpStatus = data.statusCode || null;
      result.elapsedSec = (Date.now() - startTime) / 1000;
      return result;
    }

    result.httpStatus = 200;
    result.model = data.model || config.model;
    const msg = data.choices?.[0]?.message;
    result.rounds = 1;
    result.content = msg?.content || '';
    result.reasoning = msg?.reasoning_content || '';
    result.usage = data.usage || null;

    // 工具调用处理（N 轮循环，支持树形思维链）
    if (group.useTools && msg?.tool_calls?.length) {
      const conv = [
        { role: 'system', content: body.messages[0].content },
        { role: 'user', content: question.prompt },
      ];
      result.toolCalls += msg.tool_calls.length;

      let currentMsg = msg;
      const MAX_TOOL_ROUNDS = 10;
      let safety = 0;

      while (currentMsg?.tool_calls?.length && safety < MAX_TOOL_ROUNDS) {
        safety++;

        // 将上一轮的 thinking 输出加入对话
        conv.push({ role: 'assistant', content: currentMsg.content || null, tool_calls: currentMsg.tool_calls });

        // 执行本轮所有工具调用
        for (const tc of currentMsg.tool_calls) {
          console.log(`    [${group.id}/${question.id}] 执行工具: ${tc.function.name}`);
          const toolResult = await executeTool(config, tc);
          conv.push({ role: 'tool', tool_call_id: tc.id, content: toolResult });
          result.toolCalls++;
        }

        // 继续调用：工具保持可用，让模型自己决定是否需要继续探索
        console.log(`  [${group.id}/${question.id}] 第${safety+1}轮...`);
        const nextData = await callAPI(config, {
          model: config.model,
          messages: conv,
          stream: false,
          max_tokens: 32768,
          ...group.thinkingParam,
          tools: TOOLS,
          tool_choice: 'auto'
        });

        if (nextData.error) break;

        currentMsg = nextData.choices?.[0]?.message;
        result.rounds++;

        // 合并 usage
        if (nextData.usage) {
          if (!result.usage) result.usage = {};
          result.usage.prompt_tokens = (result.usage?.prompt_tokens || 0) + (nextData.usage.prompt_tokens || 0);
          result.usage.completion_tokens = (result.usage?.completion_tokens || 0) + (nextData.usage.completion_tokens || 0);
          result.usage.total_tokens = (result.usage?.total_tokens || 0) + (nextData.usage.total_tokens || 0);
          result.usage.prompt_cache_hit_tokens = (result.usage?.prompt_cache_hit_tokens || 0) + (nextData.usage.prompt_cache_hit_tokens || 0);
          result.usage.prompt_cache_miss_tokens = (result.usage?.prompt_cache_miss_tokens || 0) + (nextData.usage.prompt_cache_miss_tokens || 0);
        }
      }

      // 最后一轮输出
      result.content = currentMsg?.content || result.content;
      result.reasoning = currentMsg?.reasoning_content || '';
    }

    // 计算缓存命中率
    if (result.usage) {
      const hit = result.usage.prompt_cache_hit_tokens || 0;
      const total = hit + (result.usage.prompt_cache_miss_tokens || result.usage.prompt_tokens || 0);
      result.cacheHitRate = total > 0 ? (hit / total * 100).toFixed(1) + '%' : '0%';
    }

  } catch (e) {
    result.error = e.message;
  }

  result.elapsedSec = (Date.now() - startTime) / 1000;
  return result;
}

// ========== 主流程 ==========
async function main() {
  console.log('============================================================');
  console.log('  AI 模型能力对比实验');
  console.log(`  组: ${GROUPS.map(g => g.id + '=' + g.name).join(' | ')}`);
  console.log(`  题: ${QUESTIONS.length} 道`);
  console.log('============================================================');
  console.log();

  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  for (const group of GROUPS) {
    console.log(`\n━━━ 组 ${group.id}: ${group.name} ━━━`);
    const config = loadConfig(group.configFile);
    console.log(`  API: ${config.baseUrl} | Model: ${config.model}`);

    for (const question of QUESTIONS) {
      console.log(`\n  --- ${question.id}: ${question.title} ---`);
      const result = await runQuestion(config, group, question);

      // 保存到文件
      const qDir = path.join(RESULTS_DIR, question.id);
      fs.mkdirSync(qDir, { recursive: true });

      const saveData = {
        ...result,
        groupName: group.name,
        config: { baseUrl: config.baseUrl, model: config.model },
        tools: group.useTools
      };

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      fs.writeFileSync(
        path.join(qDir, `${group.id}_${timestamp}.json`),
        JSON.stringify(saveData, null, 2),
        'utf-8'
      );

      const md = [
        `# ${group.id}: ${group.name} — ${question.id}: ${question.title}`,
        ``,
        `**用时**: ${result.elapsedSec.toFixed(1)}s | **轮次**: ${result.rounds} | **工具调用**: ${result.toolCalls}`,
        result.error ? `**错误**: ${result.error}` : '',
        result.usage ? `**Token**: prompt=${result.usage.prompt_tokens} completion=${result.usage.completion_tokens} total=${result.usage.total_tokens}` : '',
        result.usage ? `**缓存命中率**: ${result.cacheHitRate}` : '',
        ``,
        `## 推理过程`,
        ``,
        result.reasoning ? '```\n' + result.reasoning + '\n```' : '(无)',
        ``,
        `## 最终输出`,
        ``,
        result.content || '(无输出)',
      ].filter(Boolean).join('\n');

      fs.writeFileSync(path.join(qDir, `${group.id}_${timestamp}.md`), md, 'utf-8');

      console.log(`  → ${result.error ? '❌ ' + result.error : '✅ ' + result.elapsedSec.toFixed(1) + 's'}, Token: ${result.usage?.total_tokens || 'N/A'}, 缓存: ${result.cacheHitRate}`);
    }
  }

  console.log(`\n============================================================`);
  console.log(`  实验完成！结果保存在: ${RESULTS_DIR}`);
  console.log(`============================================================`);
}

main().catch(e => { console.error('❌ 实验失败:', e); process.exit(1); });
