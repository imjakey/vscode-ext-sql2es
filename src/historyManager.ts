import * as vscode from 'vscode';

/**
 * 转换历史记录项接口
 */
export interface ConversionHistoryItem {
  id: string;           // 唯一标识符
  timestamp: number;    // 转换时间戳
  sqlQuery: string;     // 原始SQL查询
  esQuery?: string;     // 转换后的ES查询DSL
  apiPath?: string;     // ES API路径
  curlCommand?: string; // 转换后的curl命令
  type: 'dsl' | 'curl'; // 转换类型
}

/**
 * 转换历史记录管理器
 * 负责存储和管理SQL到ES的转换历史记录
 */
export class HistoryManager {
  private static readonly STORAGE_KEY = 'sql2es.conversionHistory';
  private static readonly MAX_HISTORY_ITEMS = 50; // 最大历史记录数量

  constructor(private readonly storage: vscode.Memento) { }

  /**
   * 获取所有转换历史记录
   * @returns 转换历史记录数组
   */
  async getConversionHistory(): Promise<ConversionHistoryItem[]> {
    const history = this.storage.get<ConversionHistoryItem[]>(HistoryManager.STORAGE_KEY, []);
    // 按时间戳降序排序（最新的在前）
    return history.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 保存转换历史记录
   * @param sqlQuery 原始SQL查询
   * @param conversionResult 转换结果
   * @param type 转换类型
   */
  async saveConversionHistory(
    sqlQuery: string,
    conversionResult: { apiPath?: string; queryDSL?: string; curlCommand?: string },
    type: 'dsl' | 'curl'
  ): Promise<void> {
    // 确保SQL查询不为空
    if (!sqlQuery || sqlQuery.trim() === '') {
      return;
    }

    // 获取现有历史记录
    const history = await this.getConversionHistory();

    // 创建新的历史记录项
    const newItem: ConversionHistoryItem = {
      id: this.generateUniqueId(),
      timestamp: Date.now(),
      sqlQuery: sqlQuery.trim(),
      esQuery: conversionResult.queryDSL,
      apiPath: conversionResult.apiPath,
      curlCommand: conversionResult.curlCommand,
      type: type
    };

    // 添加新项到历史记录开头
    history.unshift(newItem);

    // 限制历史记录数量
    const trimmedHistory = history.slice(0, HistoryManager.MAX_HISTORY_ITEMS);

    // 保存到存储
    await this.storage.update(HistoryManager.STORAGE_KEY, trimmedHistory);
  }

  /**
   * 清除所有转换历史记录
   */
  async clearConversionHistory(): Promise<void> {
    await this.storage.update(HistoryManager.STORAGE_KEY, []);
  }

  /**
   * 更新转换历史记录
   * @param history 新的历史记录数组
   */
  async updateConversionHistory(history: ConversionHistoryItem[]): Promise<void> {
    await this.storage.update(HistoryManager.STORAGE_KEY, history);
  }

  /**
   * 生成唯一标识符
   * @returns 唯一标识符
   */
  private generateUniqueId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }
}