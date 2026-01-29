/**
 * 本地化工具类
 * 用于在代码中获取多语言字符串
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class Localize {
  private static translations: Record<string, string> | null = null;
  private static currentLanguage: string = 'en';

  /**
   * 初始化本地化，加载翻译文件
   */
  static initialize(context: vscode.ExtensionContext): void {
    // 获取 VS Code 当前语言
    this.currentLanguage = vscode.env.language;
    
    // 构建翻译文件路径
    const extensionPath = context.extensionPath;
    const nlsFileName = this.currentLanguage.startsWith('zh') 
      ? 'package.nls.zh-cn.json' 
      : 'package.nls.json';
    const nlsFilePath = path.join(extensionPath, nlsFileName);
    
    try {
      if (fs.existsSync(nlsFilePath)) {
        const content = fs.readFileSync(nlsFilePath, 'utf-8');
        this.translations = JSON.parse(content);
      } else {
        // 回退到默认语言
        const defaultPath = path.join(extensionPath, 'package.nls.json');
        if (fs.existsSync(defaultPath)) {
          const content = fs.readFileSync(defaultPath, 'utf-8');
          this.translations = JSON.parse(content);
        }
      }
    } catch (error) {
      console.error('[SQL2ES] Failed to load translations:', error);
      this.translations = {};
    }
  }

  /**
   * 获取本地化字符串
   * @param key 字符串键名
   * @param args 插入到字符串中的参数
   * @returns 本地化字符串
   */
  static localize(key: string, ...args: any[]): string {
    // 如果翻译未加载，尝试使用 vscode.l10n.t 作为后备
    if (!this.translations) {
      try {
        if (args.length > 0) {
          return vscode.l10n.t(key, ...args);
        }
        return vscode.l10n.t(key);
      } catch {
        return key;
      }
    }

    // 从翻译文件中获取
    let text = this.translations[key] || key;
    
    // 处理参数替换
    if (args.length > 0) {
      args.forEach((arg: any, index: number) => {
        text = text.replace(`{${index}}`, arg);
      });
    }
    
    return text;
  }

  /**
   * 获取所有 WebView 需要的翻译字符串
   */
  static getWebviewTranslations(): Record<string, string> {
    if (!this.translations) {
      return {};
    }

    // 筛选出 WebView 需要的键
    const webviewKeys = Object.keys(this.translations).filter(key => 
      key.startsWith('history.webview.') ||
      key.startsWith('history.action.')
    );

    const result: Record<string, string> = {};
    webviewKeys.forEach(key => {
      result[key] = this.translations![key];
    });

    return result;
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
  conversionFailed: 'error.conversionFailed',
  noHistoryRecords: 'error.noHistoryRecords'
} as const;

// 导出常用的历史记录相关键名
export const HistoryKeys = {
  viewHistoryCommand: 'history.view.title',
  clearHistoryCommand: 'history.clear.title',
  historyItemTitle: 'history.item.title',
  historyItemDetails: 'history.item.details',
  historyItemTypeDsl: 'history.item.type.dsl',
  historyItemTypeCurl: 'history.item.type.curl',
  clearHistoryConfirmation: 'history.clear.confirmation',
  historyClearedMessage: 'history.cleared.message',
  viewSQLAction: 'history.action.viewSQL',
  viewResultAction: 'history.action.viewResult',
  copySQLAction: 'history.action.copySQL',
  copyResultAction: 'history.action.copyResult',
  insertSQLAction: 'history.action.insertSQL',
  insertResultAction: 'history.action.insertResult',
  searchPlaceholder: 'history.webview.searchPlaceholder',
  filterAll: 'history.webview.filterAll',
  filterDSL: 'history.webview.filterDSL',
  filterCurl: 'history.webview.filterCurl',
  refreshBtn: 'history.webview.refresh',
  colSQL: 'history.webview.colSQL',
  colType: 'history.webview.colType',
  colDate: 'history.webview.colDate',
  colActions: 'history.webview.colActions',
  loadingText: 'history.webview.loading',
  emptyText: 'history.webview.empty',
  deleteBtn: 'history.webview.delete',
  prevBtn: 'history.webview.prev',
  nextBtn: 'history.webview.next',
  pageInfo: 'history.webview.pageInfo'
} as const;
