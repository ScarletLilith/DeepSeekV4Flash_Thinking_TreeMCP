import { z } from "zod";

// ─── Branch Node (server-side storage, never exposed to thinking model) ───
export const BranchNodeSchema = z.object({
  node_id: z.string().describe("唯一节点标识，格式 n_xxx"),
  session_id: z.string(),
  parent_node_id: z.string().default("trunk").describe("父节点ID，若为树干则为'trunk'"),
  call_type: z.string().describe("调用类型: drill_down | verify | explore | stash"),
  input_text: z.string().describe("主模型传入的子问题"),
  conclusion: z.string().describe("从模型输出中提取的完整结论，无长度硬限"),
  raw_process: z.string().describe("内部模型的完整推理过程"),
  confidence: z.number().nullable().optional().describe("模型自评或估算的置信度"),
  created_at: z.string().datetime().describe("ISO 8601 创建时间"),
});

export type BranchNode = z.infer<typeof BranchNodeSchema>;

// ─── create_branch ────────────────────────────────────────────────────────
export const CreateBranchInputSchema = z.object({
  session_id: z.string(),
  input_text: z.string().min(30, "子问题描述过短，无法独立求解。").describe("具体、自包含的子问题描述"),
  call_type: z.enum(["drill_down", "verify", "explore", "stash"]).default("drill_down").describe("调用类型"),
  parent_node_id: z.string().default("trunk").describe("挂载的父节点ID"),
});

export type CreateBranchInput = z.infer<typeof CreateBranchInputSchema>;

export const CreateBranchOutputSchema = z.object({
  status: z.string().default("success"),
  node_id: z.string(),
  conclusion: z.string().describe("可直接使用的结论文本"),
  confidence: z.number().nullable().optional(),
});

export type CreateBranchOutput = z.infer<typeof CreateBranchOutputSchema>;

// ─── get_branch_details ───────────────────────────────────────────────────
export const GetBranchDetailsInputSchema = z.object({
  session_id: z.string(),
  node_id: z.string(),
});

export type GetBranchDetailsInput = z.infer<typeof GetBranchDetailsInputSchema>;

export const GetBranchDetailsOutputSchema = z.object({
  status: z.string().default("success"),
  node_id: z.string(),
  raw_process: z.string().describe("内部模型生成的完整推理过程"),
});

export type GetBranchDetailsOutput = z.infer<typeof GetBranchDetailsOutputSchema>;

// ─── legacy chat_agent ────────────────────────────────────────────────────
export const ChatAgentArgsSchema = z.object({
  input_text: z.string().min(1),
  system_prompt: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  top_p: z.number().min(0).max(1).default(0.9),
  max_tokens: z.number().min(1).max(384000).default(4096),
  stop: z.array(z.string()).default([]),
  seed: z.number().optional(),
});

export type ChatAgentArgs = z.infer<typeof ChatAgentArgsSchema>;
