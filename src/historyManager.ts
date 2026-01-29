import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

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
 * 使用文件系统存储(JSON文件)替代 VS Code Memento
 */
export class HistoryManager {
  private static readonly MAX_HISTORY_ITEMS = 1000; // 最大历史记录数量
  private static readonly HISTORY_FILE = 'history.json';
  
  private historyFilePath: string;

  constructor(private readonly context: vscode.ExtensionContext) {
    // 使用 globalStorageUri 作为存储目录
    const storageUri = context.globalStorageUri;
    this.historyFilePath = path.join(storageUri.fsPath, HistoryManager.HISTORY_FILE);
    
    // 确保存储目录存在
    this.ensureStorageDirectory();
  }

  /**
   * 确保存储目录存在
   */
  private ensureStorageDirectory(): void {
    const storageDir = path.dirname(this.historyFilePath);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
  }

  /**
   * 读取历史记录文件
   */
  private readHistoryFile(): ConversionHistoryItem[] {
    try {
      if (!fs.existsSync(this.historyFilePath)) {
        return [];
      }
      const data = fs.readFileSync(this.historyFilePath, 'utf-8');
      const history = JSON.parse(data) as ConversionHistoryItem[];
      return Array.isArray(history) ? history : [];
    } catch (error) {
      console.error('[SQL2ES] Failed to read history file:', error);
      return [];
    }
  }

  /**
   * 写入历史记录文件
   */
  private writeHistoryFile(history: ConversionHistoryItem[]): void {
    try {
      this.ensureStorageDirectory();
      fs.writeFileSync(this.historyFilePath, JSON.stringify(history, null, 2), 'utf-8');
    } catch (error) {
      console.error('[SQL2ES] Failed to write history file:', error);
      throw error;
    }
  }

  /**
   * 获取所有转换历史记录
   * @returns 转换历史记录数组
   */
  async getConversionHistory(): Promise<ConversionHistoryItem[]> {
    const history = this.readHistoryFile();
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

    // 保存到文件
    this.writeHistoryFile(trimmedHistory);
  }

  /**
   * 清除所有转换历史记录
   */
  async clearConversionHistory(): Promise<void> {
    try {
      if (fs.existsSync(this.historyFilePath)) {
        fs.unlinkSync(this.historyFilePath);
      }
    } catch (error) {
      console.error('[SQL2ES] Failed to clear history:', error);
      throw error;
    }
  }

  /**
   * 更新转换历史记录
   * @param history 新的历史记录数组
   */
  async updateConversionHistory(history: ConversionHistoryItem[]): Promise<void> {
    this.writeHistoryFile(history);
  }

  /**
   * 更新单个转换历史记录
   * @param id 要更新的记录ID
   * @param updatedItem 更新后的记录
   */
  async updateSingleConversionHistory(id: string, updatedItem: Partial<ConversionHistoryItem>): Promise<boolean> {
    const history = await this.getConversionHistory();
    const index = history.findIndex(item => item.id === id);

    if (index !== -1) {
      // 合并更新的字段
      history[index] = { ...history[index], ...updatedItem };
      // 保存到文件
      this.writeHistoryFile(history);
      return true;
    }

    return false;
  }

  /**
   * 删除单条历史记录
   * @param id 要删除的记录ID
   */
  async deleteConversionHistory(id: string): Promise<boolean> {
    const history = await this.getConversionHistory();
    const index = history.findIndex(item => item.id === id);
    
    if (index !== -1) {
      history.splice(index, 1);
      this.writeHistoryFile(history);
      return true;
    }
    
    return false;
  }

  /**
   * 获取历史记录总数
   */
  async getHistoryCount(): Promise<number> {
    const history = await this.getConversionHistory();
    return history.length;
  }

  /**
   * 生成唯一标识符
   * @returns 唯一标识符
   */
  private generateUniqueId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }
}
