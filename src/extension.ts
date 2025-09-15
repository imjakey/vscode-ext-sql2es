import * as vscode from 'vscode';
import { SQLToESConverter } from './converter';
import { Localize, ErrorKeys, HistoryKeys } from './localize';
import { ConfigManager } from './config';
import { HistoryManager, ConversionHistoryItem } from './historyManager';

export function activate(context: vscode.ExtensionContext) {
	console.log('SQL to ES extension is now active!');

	const configManager = new ConfigManager();
	const converter = new SQLToESConverter(configManager);
	const historyManager = new HistoryManager(context.globalState);

	// 注册命令：转换选中的文本
	let disposableConvertSelected = vscode.commands.registerCommand('sql2es.convert', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage(Localize.localize(ErrorKeys.noActiveEditor));
			return;
		}

		const selection = editor.selection;
		const selectedText = editor.document.getText(selection);

		if (!selectedText.trim()) {
			vscode.window.showErrorMessage(Localize.localize(ErrorKeys.noTextSelected));
			return;
		}

		try {
			const result = await converter.convertSQLToES(selectedText);
			await converter.insertResult(result, selection);
			// 保存转换历史
			await historyManager.saveConversionHistory(selectedText, result, 'dsl');
		} catch (error) {
			vscode.window.showErrorMessage(Localize.localize(ErrorKeys.conversionFailed, error));
		}
	});

	// 注册命令：将选中的SQL转换为curl命令
	let disposableConvertToCurl = vscode.commands.registerCommand('sql2es.convertToCurl', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage(Localize.localize(ErrorKeys.noActiveEditor));
			return;
		}

		const selection = editor.selection;
		const selectedText = editor.document.getText(selection);

		if (!selectedText.trim()) {
			vscode.window.showErrorMessage(Localize.localize(ErrorKeys.noTextSelected));
			return;
		}

		try {
			const curlCommand = await converter.convertSQLToCurl(selectedText);
			await converter.insertCurlResult(curlCommand, selection);
			// 保存转换历史
			await historyManager.saveConversionHistory(selectedText, { curlCommand }, 'curl');
		} catch (error) {
			vscode.window.showErrorMessage(Localize.localize(ErrorKeys.conversionFailed, error));
		}
	});

	// 注册命令：查看转换历史
	let disposableViewHistory = vscode.commands.registerCommand('sql2es.viewHistory', async () => {
		try {
			const history = await historyManager.getConversionHistory();
			
			// 创建webview面板
			const panel = vscode.window.createWebviewPanel(
				'sql2esHistory',
				Localize.localize(HistoryKeys.viewHistoryCommand),
				vscode.ViewColumn.One,
				{
					enableScripts: true,
					retainContextWhenHidden: true
				}
			);

			// 格式化时间戳为可读时间
			const formatDate = (timestamp: number): string => {
				const date = new Date(timestamp);
				return date.toLocaleString();
			};

			// 提供初始HTML内容
			updateWebviewContent(panel, history, formatDate);

			// 监听webview消息
			panel.webview.onDidReceiveMessage(async message => {
				switch (message.command) {
					case 'copySQL':
						// 查找对应的历史记录项
						const itemToCopySQL = history.find(item => item.id === message.id);
						if (itemToCopySQL) {
							await vscode.env.clipboard.writeText(itemToCopySQL.sqlQuery);
							panel.webview.postMessage({ command: 'showNotification', text: 'SQL copied to clipboard' });
						}
						break;
					case 'copyResult':
						// 查找对应的历史记录项
						const itemToCopyResult = history.find(item => item.id === message.id);
						if (itemToCopyResult) {
							const resultToCopy = itemToCopyResult.type === 'dsl' 
								? (itemToCopyResult.apiPath ? itemToCopyResult.apiPath + '\n' : '') + (itemToCopyResult.esQuery || '')
								: itemToCopyResult.curlCommand || '';
							await vscode.env.clipboard.writeText(resultToCopy);
							panel.webview.postMessage({ command: 'showNotification', text: 'Result copied to clipboard' });
						}
						break;
					case 'confirmDelete':
						// 使用VS Code的API显示确认对话框
						const deleteConfirmed = await vscode.window.showInformationMessage(
							'Are you sure you want to delete this record?',
							{ modal: true },
							'Yes',
							'No'
						);
						if (deleteConfirmed === 'Yes') {
							// 执行删除操作
							const newHistory = history.filter(item => item.id !== message.id);
							await historyManager.updateConversionHistory(newHistory);
							// 更新历史记录数组
							history.length = 0;
							newHistory.forEach(item => history.push(item));
							// 更新webview内容
							updateWebviewContent(panel, history, formatDate);
							panel.webview.postMessage({ command: 'showNotification', text: 'Record deleted' });
						}
						break;
					case 'deleteRecord':
						// 为了向后兼容，保留原有的deleteRecord命令处理
						const newHistoryCompat = history.filter(item => item.id !== message.id);
						await historyManager.updateConversionHistory(newHistoryCompat);
						// 更新历史记录数组
						history.length = 0;
						newHistoryCompat.forEach(item => history.push(item));
						// 更新webview内容
						updateWebviewContent(panel, history, formatDate);
						panel.webview.postMessage({ command: 'showNotification', text: 'Record deleted' });
						break;
					case 'changePage':
						// 更新webview内容显示新的页面
						updateWebviewContent(panel, history, formatDate, message.page);
						break;
				}
			}, undefined, context.subscriptions);

			// 如果没有历史记录，更新webview内容显示空状态
			if (history.length === 0) {
				updateWebviewContent(panel, history, formatDate);
			}

		} catch (error) {
			vscode.window.showErrorMessage(Localize.localize(ErrorKeys.conversionFailed, error));
		}
	});

	/**
	 * 更新webview内容
	 */
	function updateWebviewContent(panel: vscode.WebviewPanel, history: ConversionHistoryItem[], formatDate: (timestamp: number) => string, page: number = 1) {
		const itemsPerPage = 10;
		const totalPages = Math.ceil(history.length / itemsPerPage);
		const startIndex = (page - 1) * itemsPerPage;
		const endIndex = Math.min(startIndex + itemsPerPage, history.length);
		const currentPageItems = history.slice(startIndex, endIndex);

		// 预获取所有需要的本地化字符串
		const noHistoryRecordsText = Localize.localize(ErrorKeys.noHistoryRecords);
		const viewHistoryCommandText = Localize.localize(HistoryKeys.viewHistoryCommand);

		// 生成表格HTML
		let tableHtml = '';
		if (history.length === 0) {
			tableHtml = `<div style="text-align: center; padding: 20px; color: #666;">${noHistoryRecordsText}</div>`;
		} else {
			tableHtml = `
				<table style="width: 100%; border-collapse: collapse; font-family: var(--vscode-font-family);">
					<thead>
						<tr style="background-color: var(--vscode-list-hoverBackground);">
							<th style="padding: 10px; text-align: left; border-bottom: 1px solid var(--vscode-editorGroupHeader-tabsBorder);">SQL Query</th>
							<th style="padding: 10px; text-align: left; border-bottom: 1px solid var(--vscode-editorGroupHeader-tabsBorder);">Type</th>
							<th style="padding: 10px; text-align: left; border-bottom: 1px solid var(--vscode-editorGroupHeader-tabsBorder);">Date</th>
							<th style="padding: 10px; text-align: left; border-bottom: 1px solid var(--vscode-editorGroupHeader-tabsBorder);">Actions</th>
						</tr>
					</thead>
					<tbody>
						${currentPageItems.map(item => `
							<tr style="${currentPageItems.indexOf(item) % 2 === 0 ? 'background-color: var(--vscode-editor-background);' : 'background-color: var(--vscode-editor-inactiveSelectionBackground);'}">
								<td style="padding: 8px; border-bottom: 1px solid var(--vscode-editorGroupHeader-tabsBorder); max-width: 400px; word-break: break-all;">${escapeHtml(item.sqlQuery.substring(0, 100))}${item.sqlQuery.length > 100 ? '...' : ''}</td>
								<td style="padding: 8px; border-bottom: 1px solid var(--vscode-editorGroupHeader-tabsBorder);">${item.type === 'dsl' ? 'DSL' : 'Curl'}</td>
								<td style="padding: 8px; border-bottom: 1px solid var(--vscode-editorGroupHeader-tabsBorder);">${formatDate(item.timestamp)}</td>
								<td style="padding: 8px; border-bottom: 1px solid var(--vscode-editorGroupHeader-tabsBorder);">
									<button onclick="copySQL('${item.id}')" style="margin-right: 5px; padding: 4px 8px; background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 3px; cursor: pointer;">Copy SQL</button>
									<button onclick="copyResult('${item.id}')" style="margin-right: 5px; padding: 4px 8px; background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 3px; cursor: pointer;">Copy DSL</button>
									<button onclick="deleteRecord('${item.id}')" style="padding: 4px 8px; background-color: var(--vscode-errorForeground); color: white; border: none; border-radius: 3px; cursor: pointer;">Delete</button>
								</td>
							</tr>
						`).join('')}
					</tbody>
				</table>`;
		}

		// 生成分页HTML
		let paginationHtml = '';
		if (history.length > 0) {
			paginationHtml = `
				<div style="margin-top: 20px; text-align: center;">
					<button onclick="changePage(${page > 1 ? page - 1 : 1})" disabled="${page === 1}" style="margin-right: 10px; padding: 4px 10px; background-color: ${page === 1 ? 'var(--vscode-button-secondaryBackground)' : 'var(--vscode-button-background)'}; color: ${page === 1 ? 'var(--vscode-button-secondaryForeground)' : 'var(--vscode-button-foreground)'}; border: none; border-radius: 3px; cursor: ${page === 1 ? 'not-allowed' : 'pointer'};">Previous</button>
					<span style="margin: 0 10px;">Page ${page} of ${totalPages}</span>
					<button onclick="changePage(${page < totalPages ? page + 1 : totalPages})" disabled="${page === totalPages}" style="margin-left: 10px; padding: 4px 10px; background-color: ${page === totalPages ? 'var(--vscode-button-secondaryBackground)' : 'var(--vscode-button-background)'}; color: ${page === totalPages ? 'var(--vscode-button-secondaryForeground)' : 'var(--vscode-button-foreground)'}; border: none; border-radius: 3px; cursor: ${page === totalPages ? 'not-allowed' : 'pointer'};">Next</button>
				</div>`;
		}

		// 生成完整的HTML
		const html = `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>${viewHistoryCommandText}</title>
				<style>
					body {
						background-color: var(--vscode-editor-background);
						color: var(--vscode-editor-foreground);
						padding: 20px;
						margin: 0;
					}
					h1 {
						color: var(--vscode-editor-foreground);
						margin-bottom: 20px;
					}
					button:disabled {
						opacity: 0.5;
					}
				</style>
			</head>
			<body>
				<h1>${viewHistoryCommandText}</h1>
				${tableHtml}
				${paginationHtml}
				
				<script>
					const vscode = acquireVsCodeApi();
					
					function copySQL(id) {
						vscode.postMessage({ command: 'copySQL', id: id });
					}
					
					function copyResult(id) {
						vscode.postMessage({ command: 'copyResult', id: id });
					}
					
					function deleteRecord(id) {
						// 不使用confirm()，而是向扩展发送消息，由扩展端显示确认对话框
						vscode.postMessage({ command: 'confirmDelete', id: id });
					}
					
					function changePage(page) {
						vscode.postMessage({ command: 'changePage', page: page });
					}
					
					// 监听来自扩展的消息
					window.addEventListener('message', event => {
						const message = event.data;
						switch (message.command) {
							case 'showNotification':
								alert(message.text);
								break;
						}
					});
				</script>
			</body>
			</html>
		`;

		// 设置webview内容
		panel.webview.html = html;
	}

	/**
	 * HTML转义函数
	 */
	function escapeHtml(text: string): string {
		// 使用简单的字符串替换进行HTML转义，避免创建DOM元素
		const map: { [key: string]: string } = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			'\'': '&#039;'
		};
		return text.replace(/[&<>"']/g, (m) => map[m]);
	}

	// 注册命令：清除转换历史
	let disposableClearHistory = vscode.commands.registerCommand('sql2es.clearHistory', async () => {
		const confirmation = await vscode.window.showInformationMessage(
			Localize.localize(HistoryKeys.clearHistoryConfirmation),
			{ modal: true },
			'Yes', 'No'
		);

		if (confirmation === 'Yes') {
			try {
				await historyManager.clearConversionHistory();
				vscode.window.showInformationMessage(Localize.localize(HistoryKeys.historyClearedMessage));
			} catch (error) {
				vscode.window.showErrorMessage(Localize.localize(ErrorKeys.conversionFailed, error));
			}
		}
	});

	/**
	 * 处理历史记录项的操作
	 */
	async function handleHistoryItem(item: ConversionHistoryItem): Promise<void> {
		// 创建操作菜单
		const actions = [
			{ label: Localize.localize(HistoryKeys.viewSQLAction), action: 'viewSQL' },
			{ label: Localize.localize(HistoryKeys.viewResultAction), action: 'viewResult' },
			{ label: Localize.localize(HistoryKeys.copySQLAction), action: 'copySQL' },
			{ label: Localize.localize(HistoryKeys.copyResultAction), action: 'copyResult' },
			{ label: Localize.localize(HistoryKeys.insertSQLAction), action: 'insertSQL' },
			{ label: Localize.localize(HistoryKeys.insertResultAction), action: 'insertResult' }
		];

		const selectedAction = await vscode.window.showQuickPick(actions, {
			placeHolder: 'Select an action',
			canPickMany: false
		});

		if (!selectedAction) return;

		const editor = vscode.window.activeTextEditor;

		switch (selectedAction.action) {
			case 'viewSQL':
				// 在新文档中显示SQL
				const sqlDoc = await vscode.workspace.openTextDocument({
					content: item.sqlQuery,
					language: 'sql'
				});
				await vscode.window.showTextDocument(sqlDoc, { preview: false });
				break;
			case 'viewResult':
				// 在新文档中显示结果
				const resultContent = item.type === 'dsl' 
					? (item.apiPath ? item.apiPath + '\n\n' : '') + (item.esQuery || '')
					: item.curlCommand || '';
				const resultDoc = await vscode.workspace.openTextDocument({
					content: resultContent,
					language: item.type === 'dsl' ? 'json' : 'shellscript'
				});
				await vscode.window.showTextDocument(resultDoc, { preview: false });
				break;
			case 'copySQL':
				// 复制SQL到剪贴板
				await vscode.env.clipboard.writeText(item.sqlQuery);
				vscode.window.showInformationMessage('SQL copied to clipboard');
				break;
			case 'copyResult':
				// 复制结果到剪贴板
				const resultToCopy = item.type === 'dsl' 
					? (item.apiPath ? item.apiPath + '\n' : '') + (item.esQuery || '')
					: item.curlCommand || '';
				await vscode.env.clipboard.writeText(resultToCopy);
				vscode.window.showInformationMessage('Result copied to clipboard');
				break;
			case 'insertSQL':
				// 插入SQL到当前编辑器
				if (editor) {
					await editor.edit(editBuilder => {
						editBuilder.insert(editor.selection.active, item.sqlQuery);
					});
				} else {
					vscode.window.showErrorMessage(Localize.localize(ErrorKeys.noActiveEditor));
				}
				break;
			case 'insertResult':
				// 插入结果到当前编辑器
				if (editor) {
					const resultToInsert = item.type === 'dsl' 
						? (item.apiPath ? item.apiPath + '\n' : '') + (item.esQuery || '')
						: item.curlCommand || '';
					await editor.edit(editBuilder => {
						editBuilder.insert(editor.selection.active, resultToInsert);
					});
				} else {
					vscode.window.showErrorMessage(Localize.localize(ErrorKeys.noActiveEditor));
				}
				break;
		}
	}

	context.subscriptions.push(disposableConvertSelected);
	context.subscriptions.push(disposableConvertToCurl);
	context.subscriptions.push(disposableViewHistory);
	context.subscriptions.push(disposableClearHistory);
}

export function deactivate() {
	console.log('SQL to ES extension is now deactivated!');
}