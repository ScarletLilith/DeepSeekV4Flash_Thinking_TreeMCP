export interface StrategyParams {
  temperature: number;
  top_p: number;
  max_tokens: number;
}

/**
 * 将 call_type 映射为底层模型的生成参数。
 * 不使用 top_k，通过温度组合控制发散度。
 */
export class StrategyEngine {
  private static paramsMap: Record<string, StrategyParams> = {
    drill_down: { temperature: 0.2, top_p: 0.2, max_tokens: 2048 },
    verify:     { temperature: 0.0, top_p: 0.1, max_tokens: 2048 },
    explore:    { temperature: 1.0, top_p: 0.9, max_tokens: 2048 },
    stash:      { temperature: 0.6, top_p: 0.6, max_tokens: 2048 },
  };

  static getParams(callType: string): StrategyParams {
    return this.paramsMap[callType] ?? this.paramsMap["drill_down"];
  }
}
