# SQL to Elasticsearch Converter

[English](README.en.md) | 中文
这是一个VSCode扩展，可以将选中的SQL文本转换为Elasticsearch查询语句。

## 多语言支持

本扩展支持多语言界面，会根据VSCode的当前语言自动选择显示语言。目前支持以下语言：

- 英语（默认）
- 中文（简体）

如果您使用的是其他语言，扩展将默认显示为英语。

## 功能特性

1. 将SQL查询转换为Elasticsearch查询DSL
2. 将SQL查询转换为Elasticsearch的curl命令
3. 支持多种使用方式：
   - 通过命令面板执行转换
   - 通过右键菜单转换选中的SQL文本
4. 转换结果自动格式化
5. 可配置AI模型参数
6. 多语言支持（英语和中文）

## 安装

1. 在VSCode中安装此扩展
2. 在扩展设置中配置AI模型的API密钥和其他参数

## 使用方法

### 配置

在使用扩展之前，需要配置以下参数：

1. `sql2es.apiKey` - AI模型服务的API密钥
2. `sql2es.apiEndpoint` - AI模型服务的端点URL（默认为OpenAI）
3. `sql2es.model` - 要使用的AI模型名称
4. `sql2es.esVersion` - Elasticsearch版本（默认为7.x）
5. `sql2es.esUsername` - Elasticsearch用户名，用于curl命令中的鉴权参数
6. `sql2es.esPassword` - Elasticsearch密码

### 转换SQL查询

有三种方式可以转换SQL查询：

1. **命令面板方式**（转换为DSL）：
   - 打开包含SQL查询的文件
   - 按 `Ctrl+Shift+P` 打开命令面板
   - 输入 "SQL2Es: Convert SQL to Elasticsearch DSL" 并执行

2. **右键菜单方式**（转换为DSL）：
   - 在SQL文件中选择要转换的文本
   - 右键点击选中的文本
   - 选择 "SQL2Es: Convert Selected SQL to Elasticsearch DSL"

3. **右键菜单方式**（转换为curl命令）：
   - 在SQL文件中选择要转换的文本
   - 右键点击选中的文本
   - 选择 "SQL2Es: Convert Selected SQL to Elasticsearch Curl Command"

转换结果将直接插入到原SQL的下一行，包含正确的HTTP方法和API路径，以及格式化后的Elasticsearch查询DSL或curl命令。

## 支持的AI模型

此扩展支持任何兼容OpenAI API的模型，包括：

- OpenAI的GPT系列模型
- Azure OpenAI服务
- 其他兼容OpenAI API的第三方服务

## 注意事项

- 需要有效的API密钥才能使用此扩展
- 转换质量取决于所使用的AI模型
- 确保网络连接正常以访问AI模型API