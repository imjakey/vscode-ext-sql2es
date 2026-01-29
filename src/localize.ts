/**
 * 本地化工具类
 * 用于在代码中获取多语言字符串
 */
import * as vscode from 'vscode';

export class Localize {
  /**
   * 获取本地化字符串
   * @param key 字符串键名
   * @param args 插入到字符串中的参数
   * @returns 本地化字符串
   */
  static localize(key: string, ...args: any[]): string {
    try {
      // 使用VS Code的l10n API获取本地化字符串
      if (args.length > 0) {
        return vscode.l10n.t(key, ...args);
      }
      return vscode.l10n.t(key);
    } catch (error) {
      // 如果l10n API不可用或出现错误，则返回键名
      // 处理参数替换
      if (args.length > 0) {
        let result = key;
        args.forEach((arg: any, index: number) => {
          result = result.replace(`{${index}}`, arg);
        });
        return result;
      }
      return key;
    }
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