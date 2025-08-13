import * as vscode from 'vscode';

/**
 * 本地化工具类
 * 用于在代码中获取多语言字符串
 */
export class Localize {
  private static bundle = vscode.l10n.bundle;
  
  /**
   * 获取本地化字符串
   * @param key 字符串键名
   * @param args 插入到字符串中的参数
   * @returns 本地化字符串
   */
  static localize(key: string, ...args: any[]): string {
    return vscode.l10n.t(key, ...args);
  }
}

// 导出常用的错误消息键名
export const ErrorKeys = {
  emptySQL: 'error.emptySQL',
  noAPIKey: 'error.noAPIKey',
  apiRequestFailed: 'error.apiRequestFailed',
  noAIResults: 'error.noAIResults',
  noActiveEditor: 'error.noActiveEditor',
  noTextSelected: 'error.noTextSelected',
  conversionFailed: 'error.conversionFailed'
} as const;