import * as vscode from 'vscode';

/**
 * 配置管理类
 * 负责读取和管理扩展的配置信息
 */
export class ConfigManager {
  private readonly configPrefix = 'sql2es';

  /**
   * 获取API密钥
   * @returns API密钥
   */
  getApiKey(): string {
    return vscode.workspace.getConfiguration(this.configPrefix).get('apiKey', '');
  }

  /**
   * 获取API端点
   * @returns API端点URL
   */
  getApiEndpoint(): string {
    return vscode.workspace.getConfiguration(this.configPrefix).get('apiEndpoint', 'https://api.openai.com/v1/chat/completions');
  }

  /**
   * 获取模型名称
   * @returns 模型名称
   */
  getModel(): string {
    return vscode.workspace.getConfiguration(this.configPrefix).get('model', 'gpt-3.5-turbo');
  }

  /**
   * 获取es版本
   * @returns es版本
   */
  getEsVersion(): string {
    return vscode.workspace.getConfiguration(this.configPrefix).get('esVersion', '7.x');
  }

  /**
   * 获取es服务地址
   * @returns es服务地址
   */
  getEsEndpoint(): string {
    return vscode.workspace.getConfiguration(this.configPrefix).get('esEndpoint', 'localhost:9200');
  }

  /**
   * 获取es用户名
   * @returns es用户名
   */
  getEsUsername(): string {
    return vscode.workspace.getConfiguration(this.configPrefix).get('esUsername', '');
  }

  /**
   * 获取es密码
   * @returns es密码
   */
  getEsPassword(): string {
    return vscode.workspace.getConfiguration(this.configPrefix).get('esPassword', '');
  }
}