import * as vscode from 'vscode';
import { ConfigManager } from './config';

/**
 * SQL到Elasticsearch查询语句转换器
 * 使用AI模型将SQL查询转换为Elasticsearch查询DSL
 */
export class SQLToESConverter {
  constructor(private configManager: ConfigManager) {}

  /**
   * 将SQL查询转换为Elasticsearch查询DSL
   * @param sql SQL查询语句
   * @returns 转换后的Elasticsearch查询DSL和API路径
   */
  async convertSQLToES(sql: string): Promise<{ apiPath: string; queryDSL: string }> {
    const apiKey = this.configManager.getApiKey();
    const apiEndpoint = this.configManager.getApiEndpoint();
    const model = this.configManager.getModel();
    const esVersion = this.configManager.getEsVersion();

    if (!apiKey) {
      throw new Error('API key is not configured. Please set it in the extension settings.');
    }

    // 构建AI模型的提示
    const prompt = `Convert the following SQL query to Elasticsearch ${esVersion} query DSL. Return the HTTP method and path on the first line, followed by the JSON DSL on the second line. Do not include any explanation:\n\n${sql}`;

    // 调用AI模型API
    const response = await this.callAIModel(apiEndpoint, apiKey, model, prompt);
    
    // 解析API路径和查询DSL
    const lines = response.split('\n');
    const apiPath = lines[0].trim();
    const queryDSL = lines.slice(1).join('\n').trim();
    
    // 格式化返回的JSON
    const formattedDSL = this.formatJSON(queryDSL);
    
    return { apiPath, queryDSL: formattedDSL };
  }

  /**
   * 调用AI模型API
   * @param endpoint API端点
   * @param apiKey API密钥
   * @param model 模型名称
   * @param prompt 提示文本
   * @returns AI模型的响应
   */
  private async callAIModel(endpoint: string, apiKey: string, model: string, prompt: string): Promise<string> {
    const requestBody = {
      model: model,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`AI model API request failed with status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('AI model returned no results');
    }

    return data.choices[0].message.content.trim();
  }

  /**
   * 格式化JSON字符串
   * @param jsonString JSON字符串
   * @returns 格式化后的JSON字符串
   */
  private formatJSON(jsonString: string): string {
    try {
      // 尝试解析JSON以确保其有效性
      const parsed = JSON.parse(jsonString);
      // 返回格式化的JSON
      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      // 如果不是有效的JSON，直接返回原字符串
      return jsonString;
    }
  }

  /**
   * 将转换结果插入到编辑器中
   * @param result 转换结果
   * @param selection 插入位置
   */
  async insertResult(result: { apiPath: string; queryDSL: string }, selection: vscode.Selection): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      throw new Error('No active editor found!');
    }

    // 构建要插入的文本
    const insertText = `\n${result.apiPath}\n${result.queryDSL}\n`;

    // 在选择文本后插入结果
    await editor.edit(editBuilder => {
      editBuilder.insert(selection.end, insertText);
    });
  }

  /**
   * 将SQL查询转换为Elasticsearch的curl命令
   * @param sql SQL查询语句
   * @returns Elasticsearch的curl命令
   */
  async convertSQLToCurl(sql: string): Promise<string> {
    // 首先获取API路径和查询DSL
    const { apiPath, queryDSL } = await this.convertSQLToES(sql);
    
    // 解析HTTP方法和路径
    const parts = apiPath.split(' ');
    const method = parts[0];
    const path = parts.slice(1).join(' ');

    const esEndpoint = this.configManager.getEsEndpoint();
    
    // 构建curl命令
    let curlCommand = `curl -X ${method} -H "Content-Type: application/json"`;

    // 添加用户名和密码
    const username = this.configManager.getEsUsername();
    const password = this.configManager.getEsPassword();
    if (username && password) {
      curlCommand += ` -u "${username}:${password}"`;
    }
    
    curlCommand += `" ${esEndpoint}${path}"`;
    
    if (queryDSL !== '') {
      curlCommand += ` -d '${queryDSL}'`;
    }
    return curlCommand;
  }

  /**
   * 将curl命令插入到编辑器中
   * @param curlCommand curl命令
   * @param selection 插入位置
   */
  async insertCurlResult(curlCommand: string, selection: vscode.Selection): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      throw new Error('No active editor found!');
    }

    // 构建要插入的文本
    const insertText = `\n${curlCommand}\n`;

    // 在选择文本后插入结果
    await editor.edit(editBuilder => {
      editBuilder.insert(selection.end, insertText);
    });
  }

  /**
   * 显示转换结果（已废弃，保留以兼容性）
   * @param result 转换结果
   */
  async showResult(result: string): Promise<void> {
    // 创建新的文档来显示结果
    const document = await vscode.workspace.openTextDocument({
      content: result,
      language: 'json'
    });
    
    // 显示文档
    await vscode.window.showTextDocument(document, {
      preview: false
    });
  }
}