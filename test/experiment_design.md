# 对比实验方案：GLM-5.2 vs DeepSeek-V4-Flash（带工具 vs 纯思考）

## 实验设计

### 三组对照

| 组别 | 模型 | API 平台 | 模式 | 工具 |
|:----:|------|:--------:|:----:|:----:|
| **A** | zai-org/GLM-5.2 | **SiliconFlow** | 原生推理 | 无（模型原生能力） |
| **B** | deepseek-ai/DeepSeek-V4-Flash | **DeepSeek 官方 API** | Max Thinking | **有**（chat_agent / create_branch） |
| **C** | deepseek-ai/DeepSeek-V4-Flash | **DeepSeek 官方 API** | Max Thinking | 无（纯思考） |

> ⚠ 注意：A 组（GLM-5.2）走 SiliconFlow，B/C 组（DeepSeek-V4-Flash）走 DeepSeek 官方 API。
> 两组 API Key 和 endpoint 不同，运行时需切换 `test/config.json`。

### 定价对比

#### SiliconFlow（人民币 ¥/1M tokens）

| 模型 | 输入 | 输出 | 缓存命中 |
|------|:----:|:----:|:--------:|
| zai-org/GLM-5.2 | ¥8.00 | ¥28.00 | ¥2.00 |
| deepseek-ai/DeepSeek-V4-Flash | ¥1.00 | ¥2.00 | ¥0.02 |
| deepseek-ai/DeepSeek-V4-Pro | ¥3.00 | ¥6.00 | ¥0.03 |

#### DeepSeek 官方 API（美元 $/1M tokens）

| 模型 | 输入（缓存未命中） | 输入（缓存命中） | 输出 |
|------|:------------------:|:----------------:|:----:|
| deepseek-v4-flash | $0.14 | $0.0028 | $0.28 |
| deepseek-v4-pro | $0.435 | $0.003625 | $0.87 |

#### API 响应中的 Token 用量与缓存字段

两组 API 都会在响应中返回 `usage` 对象，包含完整的 token 计数和缓存数据，**无需额外参数**：

```json
{
  "usage": {
    "prompt_tokens": 3355,
    "completion_tokens": 4578,
    "total_tokens": 7933,
    "prompt_cache_hit_tokens": 1200,     // 缓存命中（低价）
    "prompt_cache_miss_tokens": 2155,    // 缓存未命中（原价）
    "completion_tokens_details": {
      "reasoning_tokens": 2422           // 思考模型的思维链 token
    }
  }
}
```

#### 缓存命中率计算

```javascript
function calcCacheHitRate(usage) {
  const hit = usage.prompt_cache_hit_tokens || 0;
  const miss = usage.prompt_cache_miss_tokens || usage.prompt_tokens;
  const total = hit + miss;
  return total > 0 ? (hit / total * 100).toFixed(1) + '%' : '0%';
}
```

缓存命中率直接影响实际成本：命中率高时 input 成本可降至原价的 1/50（DeepSeek）或 1/4（GLM-5.2）。

#### 成本计算公式

```javascript
// 通用成本计算函数
function calcCost(usage, prices) {
  const inputCost = (usage.prompt_cache_hit_tokens || 0) / 1_000_000 * prices.inputCache
    + (usage.prompt_cache_miss_tokens || usage.prompt_tokens) / 1_000_000 * prices.inputMiss;
  const outputCost = usage.completion_tokens / 1_000_000 * prices.output;
  return { inputCost, outputCost, totalCost: inputCost + outputCost };
}

// DeepSeek 官方（美元）
const DEEPSEEK_PRICES = {
  inputMiss: 0.14,    // $0.14/1M tokens（cache miss）
  inputCache: 0.0028, // $0.0028/1M tokens（cache hit）
  output: 0.28,       // $0.28/1M tokens
};

// SiliconFlow GLM-5.2（人民币）
const GLM52_PRICES = {
  inputMiss: 8.0,     // ¥8/1M tokens
  inputCache: 2.0,    // ¥2/1M tokens
  output: 28.0,       // ¥28/1M tokens
};

// SiliconFlow DeepSeek-V4-Flash（人民币）
const SF_FLASH_PRICES = {
  inputMiss: 1.0,     // ¥1/1M tokens
  inputCache: 0.02,   // ¥0.02/1M tokens
  output: 2.0,        // ¥2/1M tokens
};
```

#### 成本对比示例（实测数据代入）

以上次场景B（纯思考，DeepSeek官方API）的真实用量为例：
```
prompt_tokens=3355, completion_tokens=4578
cache_miss=3355, cache_hit=0

DeepSeek 官方: (3355×$0.14 + 4578×$0.28)/1M = $0.00047 + $0.00128 = $0.00175 ≈ ¥0.0126

同等量在 GLM-5.2: (3355×¥8 + 4578×¥28)/1M = ¥0.0268 + ¥0.1282 = ¥0.155
                                                    ↑ GLM-5.2 贵 12.3 倍
```

---

## 五道工程难题（工程 + 设计双维度）

每道题要求同时从**设计层面**（架构决策、权衡分析、系统设计）和**工程层面**（实现细节、代码级方案、具体算法/数据结构）两个角度回答。

---

### 问题 1：构建一个高可用分布式事务日志系统

**背景**：某金融科技公司需要构建一个跨数据中心的分布式事务日志系统，用于审计和故障恢复。要求日志**绝对不丢失**（durability）、**全局有序**（total order）、**可回溯查询**。

**设计层面**：
1. 对比 Paxos、Raft、Zab 协议在这类场景下的适用性，给出选型论证
2. 设计跨数据中心日志复制架构：同步复制 vs 异步复制，多数派跨数据中心如何工作
3. 日志压缩与快照机制设计：如何在不影响有序性的前提下压缩历史日志
4. 容量规划：单日产生 10TB 日志，设计保留策略和分层存储方案（热/温/冷）
5. 一致性模型决策：线性一致性 vs 最终一致性在审计场景下的 trade-off

**工程层面**：
1. 给出 Raft 的 Leader 选举和日志复制的核心伪代码实现
2. 设计日志条目格式（含元数据字段），确保全局唯一性和顺序性
3. 实现日志消费者的 at-least-once / exactly-once 语义保证
4. 网络分区下的处理策略：脑裂检测和恢复的具体算法
5. 性能优化：批量写入、流水线复制、异步 fsync 的具体参数调优

**可交付**：完整架构方案 + 核心模块伪代码 + 性能模型

---

### 问题 2：设计并实现一个微服务网格的智能流量管理系统

**背景**：一个拥有 200+ 微服务的电商平台，需要引入 Service Mesh 实现流量管理、灰度发布、故障注入和全链路可观测性。当前使用 Spring Cloud，需平滑迁移。

**设计层面**：
1. Sidecar Proxy 模式 vs Proxy-less 模式选型：对比 Istio/Linkerd/Envoy 的架构差异
2. 控制面设计：服务发现、配置分发、证书管理的集中式 vs 分散式设计
3. 灰度发布策略设计：金丝雀发布、蓝绿部署、A/B 测试的流量路由规则引擎
4. 多集群/多 Region 的 Mesh 互联设计：东西向流量 vs 南北向流量管理
5. 从 Spring Cloud 到 Service Mesh 的平滑迁移策略：渐进式改造方案

**工程层面**：
1. 给出基于 Envoy 的自定义 Filter 实现流量镜像的代码框架
2. 设计故障注入的配置格式和实现机制（延迟注入、异常注入、中止注入）
3. 实现分布式链路追踪的上下文传播（W3C TraceContext 的透传实现）
4. 设计限流/熔断的滑动窗口算法：令牌桶 vs 漏桶的参数配置和实现
5. 给出 Istio 的 VirtualService / DestinationRule CRD 配置示例（灰度发布场景）

**可交付**：Mesh 架构迁移方案 + 核心 Filter 实现 + 灰度发布配置

---

### 问题 3：为嵌入式设备设计一个实时操作系统微内核

**背景**：为 IoT 边缘设备（Cortex-M4, 256KB Flash, 64KB RAM）设计一个抢占式实时操作系统微内核，需支持多任务、中断管理、内存保护。

**设计层面**：
1. 微内核架构设计：内核态与用户态的划分，哪些服务放在内核态（IPC、调度）vs 用户态（文件系统、网络栈）
2. 任务调度策略设计：RMS vs EDF vs 混合调度，如何保证硬实时任务的截止时间
3. 进程间通信（IPC）设计：消息队列 vs 共享内存 vs 信号，选择依据和性能模型
4. 中断管理设计：中断嵌套、中断线程化、最坏情况中断延迟分析
5. 内存保护方案：MPU 的配置策略，如何防止用户任务破坏内核和其他任务

**工程层面**：
1. 给出任务控制块（TCB）的数据结构定义，以及任务创建/切换的核心代码
2. 实现抢占式调度器：SVC/PendSV 异常处理流程的汇编级伪代码
3. 实现信号量/互斥量的优先级反转解决方案（优先级继承协议）
4. 实现时间片轮转调度的时间基准（SysTick 配置和上下文切换时序）
5. 给出最坏情况执行时间（WCET）的分析方法，和调度可行性测试（schedulability test）

**可交付**：微内核架构规范 + 核心调度器实现 + WCET 分析

---

### 问题 4：设计并实现一个列式存储查询引擎

**背景**：为分析型数据库设计一个列式存储引擎的查询执行模块，需支持 SQL 查询的向量化执行、谓词下推、延迟物化。数据量 PB 级。

**设计层面**：
1. 列式存储 vs 行式存储的选择依据：不同查询模式下的 I/O 模型对比
2. 查询执行架构设计：Volcano 模型 vs 向量化模型 vs 编译执行，选型论证
3. 谓词下推策略：哪些算子可以下推（Filter、Projection、Aggregation），下推到什么层级
4. 延迟物化（Late Materialization）设计：如何确定最佳的物化时机
5. 查询优化器设计：CBO vs RBO，统计信息收集和代价模型

**工程层面**：
1. 给出列式存储的数据页布局设计：Min/Max 索引、Bloom Filter、字典编码
2. 实现向量化 Hash Join 的核心算法伪代码（build + probe 阶段的 SIMD 优化）
3. 实现 Page-level 的谓词下推：扫描时直接跳过不符合条件的 Page
4. 设计编码方案：字典编码、RLE、Delta 编码的适用场景选择和实现
5. 给出 TPC-H 基准测试中 Q1/Q6 的查询计划示例和执行时间分解

**可交付**：存储格式规范 + 查询执行流水线设计 + 编码方案对比测试

---

### 问题 5：构建一个多模态 AI Agent 编排框架

**背景**：设计一个通用 AI Agent 编排框架，支持多模态输入（文本、图像、音频、代码）、多模型协同（不同模型负责不同子任务）、工具调用（API、数据库、文件系统）、记忆管理和人机协作。

**设计层面**：
1. Agent 架构设计：单一 Agent vs 多 Agent 协作（Orchestrator + Worker 模式），对比 AutoGen / CrewAI / LangGraph 的架构差异
2. 多模态融合策略：早期融合 vs 晚期融合 vs 混合融合，选型论证
3. 任务规划与分解：Plan-then-Execute vs ReAct 循环，如何保证复杂任务的完成率
4. 记忆管理设计：工作记忆、短期记忆、长期记忆的分层架构，检索策略
5. 人机协作模式：Human-in-the-Loop 的介入时机和回退策略设计

**工程层面**：
1. 给出多 Agent 通信的消息协议设计（agent_id, task_id, status, payload 的格式定义）
2. 实现工具调用的注册与发现机制：OpenAI Function Calling 格式的工具描述 Schema
3. 设计任务 DAG 的执行引擎：拓扑排序 + 并行调度 + 依赖管理
4. 实现多轮对话的上下文窗口管理：滑动窗口 vs 摘要压缩 vs KV Cache 复用
5. 给出一个具体场景的 Agent 编排示例："分析一张产品设计图 → 生成代码 → 执行测试 → 输出报告" 的完整流程图

**可交付**：Agent 框架架构 + 消息协议定义 + 场景编排示例

---

## 实验执行计划

### 环境配置

由于 A 组（GLM-5.2）走 SiliconFlow，B/C 组（DeepSeek-V4-Flash）走 DeepSeek 官方 API，**两组使用不同的 API Key 和 endpoint**。运行时通过切换 `test/config.json` 来切换：

```bash
# ─── 跑 A 组（GLM-5.2）────────────────────
# 创建 test/config.sf.json：
# {
#   "baseUrl": "https://api.siliconflow.cn/v1",
#   "model": "zai-org/GLM-5.2",
#   "apiKey": "sk-pqhlntxqypmihqexmnfcjbzygsdgmsjitmspelnhyqbnenvl"
# }
cp config.sf.json config.json

# ─── 跑 B/C 组（DeepSeek-V4-Flash）──────────
# 创建 test/config.ds.json：
# {
#   "baseUrl": "https://api.deepseek.com",
#   "model": "deepseek-v4-flash",
#   "apiKey": "sk-149bf5a8cc3a43538d0d04443077da33"
# }
cp config.ds.json config.json
```

> 注意：`test/config.json` 已被 `.gitignore` 保护，不会提交到仓库。

### 评估指标

| 指标 | 采集方式 |
|------|----------|
| 客观评分 | 每道题 10 个检查点 × 1分/个（见下方评分表）|
| Token 消耗 | API 返回的 `usage.total_tokens` |
| 实际成本 | `calcCost(usage, priceTable)` 计算 |
| 缓存命中率 | `calcCacheHitRate(usage)` 计算 |
| 响应时间 | API 端到端延迟 |
| 推理深度 | `reasoning_content` 字符数 |
| 工具利用率(B组) | 工具调用次数、类型分布 |

### 客观评分检查点（每道题）

每道题设 **10 个客观检查点**，每个 1 分，共 10 分。检查项为「有/无」二元判定——答案中明确包含该要素即得分，不依赖评分人主观判断。

---

#### Q1：分布式事务日志系统

| # | 检查点 | 分值 |
|:-:|--------|:---:|
| 1 | **一致性协议选型论证**：对比了 Paxos/Raft/Zab 并给出选择理由 | 1 |
| 2 | **跨数据中心复制架构**：给出了同步/异步选择的理由和多数据中心多数派方案 | 1 |
| 3 | **Raft Leader 选举伪代码**：给出了选举超时、Term、投票请求的核心逻辑 | 1 |
| 4 | **日志复制实现**：给出了 AppendEntries RPC 的伪代码和日志匹配/提交规则 | 1 |
| 5 | **日志压缩/快照**：给出了快照生成和安装的具体机制 | 1 |
| 6 | **分层存储方案**：给出了热/温/冷分层策略和数据迁移触发条件 | 1 |
| 7 | **exactly-once 消费**：给出了消费者幂等性保证的具体实现 | 1 |
| 8 | **脑裂检测与恢复**：给出了网络分区恢复后的状态合并算法 | 1 |
| 9 | **性能模型**：给出了批量写入、流水线复制的定量性能分析 | 1 |
| 10 | **日志条目格式**：给出了完整的日志条目数据结构定义 | 1 |

---

#### Q2：微服务网格流量管理系统

| # | 检查点 | 分值 |
|:-:|--------|:---:|
| 1 | **Sidecar vs Proxy-less 选型**：对比了 Istio/Linkerd/Envoy 架构，并给出选择 | 1 |
| 2 | **灰度发布策略**：给出了金丝雀/蓝绿/A-B 至少一种的具体流量路由方案 | 1 |
| 3 | **Envoy Filter 实现**：给出了自定义 Filter 的代码框架或配置 | 1 |
| 4 | **故障注入机制**：给出了延迟/异常/中止注入的具体配置和触发条件 | 1 |
| 5 | **链路追踪上下文传播**：给出了 W3C TraceContext 的透传实现 | 1 |
| 6 | **限流/熔断算法**：给出了令牌桶或漏桶的具体参数配置和滑动窗口实现 | 1 |
| 7 | **多集群互联设计**：给出了东西向流量的跨集群通信方案 | 1 |
| 8 | **迁移策略**：给出了从 Spring Cloud 到 Service Mesh 的渐进迁移步骤 | 1 |
| 9 | **Istio CRD 配置**：给出了 VirtualService + DestinationRule 的具体配置示例 | 1 |
| 10 | **控制面设计**：给出了证书管理/配置分发的具体架构 | 1 |

---

#### Q3：嵌入式实时操作系统微内核

| # | 检查点 | 分值 |
|:-:|--------|:---:|
| 1 | **微内核架构划分**：给出了内核态/用户态的服务划分方案 | 1 |
| 2 | **调度策略选型**：在 RMS/EDF/混合调度中给出选择并论证 | 1 |
| 3 | **任务控制块设计**：给出了 TCB 的完整数据结构定义 | 1 |
| 4 | **抢占式调度实现**：给出了 SVC/PendSV 中断处理流程 | 1 |
| 5 | **优先级反转解决**：给出了优先级继承协议的具体实现 | 1 |
| 6 | **IPC 设计**：给出了消息队列或共享内存的通信机制实现 | 1 |
| 7 | **中断管理**：给出了中断嵌套/中断线程化的设计，包含最坏延迟分析 | 1 |
| 8 | **MPU 保护策略**：给出了内存保护单元的配置和保护域划分 | 1 |
| 9 | **时间基准实现**：给出了 SysTick 配置和上下文切换时序 | 1 |
| 10 | **WCET 分析**：给出了最坏情况执行时间分析方法和可调度性测试 | 1 |

---

#### Q4：列式存储查询引擎

| # | 检查点 | 分值 |
|:-:|--------|:---:|
| 1 | **列存 vs 行存选型**：给出了不同查询模式下的 I/O 模型对比 | 1 |
| 2 | **执行模型选型**：对比了 Volcano/向量化/编译执行并给出选择 | 1 |
| 3 | **数据页布局**：给出了列存 Page 的物理格式（含 Min/Max 索引、Bloom Filter） | 1 |
| 4 | **向量化 Hash Join**：给出了 build+probe 阶段的 SIMD 优化伪代码 | 1 |
| 5 | **谓词下推策略**：给出了 Filter/Projection 下推到扫描层的机制 | 1 |
| 6 | **延迟物化设计**：给出了物化时机的决策策略 | 1 |
| 7 | **编码方案**：给出了字典/RLE/Delta 编码的适用场景和选择逻辑 | 1 |
| 8 | **查询优化器设计**：给出了 CBO 的代价估算模型或 RBO 的规则集 | 1 |
| 9 | **TPC-H 示例**：给出了 Q1 或 Q6 的查询计划和执行时间分解 | 1 |
| 10 | **查询执行流水线**：给出了完整的查询执行阶段划分和内存预算 | 1 |

---

#### Q5：多模态 AI Agent 编排框架

| # | 检查点 | 分值 |
|:-:|--------|:---:|
| 1 | **Agent 架构选型**：对比了 AutoGen/CrewAI/LangGraph，并给出架构选择 | 1 |
| 2 | **多 Agent 通信协议**：给出了消息格式定义（agent_id, task_id, status, payload） | 1 |
| 3 | **任务规划策略**：在 Plan-then-Execute / ReAct 中给出选择并论证 | 1 |
| 4 | **工具注册机制**：给出了 Function Calling Schema 的定义和注册流程 | 1 |
| 5 | **任务 DAG 引擎**：给出了拓扑排序 + 并行调度的实现框架 | 1 |
| 6 | **记忆管理架构**：给出了工作/短期/长期记忆的分层设计和检索策略 | 1 |
| 7 | **上下文管理**：给出了滑动窗口或摘要压缩的窗口管理策略 | 1 |
| 8 | **多模态融合**：给出了早期/晚期/混合融合的选型论证 | 1 |
| 9 | **Human-in-the-Loop**：给出了人工介入的触发条件和回退策略 | 1 |
| 10 | **场景编排示例**：给出了从"输入设计图→生成代码→测试→报告"的完整流程图 | 1 |

---

### 总分计算

| 维度 | 计算方式 |
|------|----------|
| **内容质量（满分 50）** | 5 道题 × 10 检查点/题 = 50 分（客观评分）|
| **成本效率（参考指标）** | `calcCost(usage, prices)` 换算为每道题的成本 |
| **响应速度（参考指标）** | 端到端响应时间 |
| **缓存利用率（参考指标）** | `calcCacheHitRate(usage)` 缓存命中率 |

最终排名按 **内容质量分** 排序，成本/速度/缓存作为辅助参考。

### 预期输出

每组对每道题的完整回答保存为：
```
results/comparison/
├── Q1_distributed_editor/
│   ├── A_glm52.md
│   ├── B_deepseek_tools.md
│   └── C_deepseek_pure.md
├── Q2_financial_risk/
│   └── ...
├── ...
└── report.md  # 综合对比报告
```
