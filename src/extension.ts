import * as vscode from 'vscode';
import { SQLToESConverter } from './converter';
import { ConfigManager } from './config';

export function activate(context: vscode.ExtensionContext) {
	console.log('SQL to ES extension is now active!');

	const configManager = new ConfigManager();
	const converter = new SQLToESConverter(configManager);

	// 注册命令：转换整个文档
	let disposableConvert = vscode.commands.registerCommand('sql2es.convert', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found!');
			return;
		}

		const document = editor.document;
		const text = document.getText();

		if (!text.trim()) {
			vscode.window.showErrorMessage('Document is empty!');
			return;
		}

		try {
			const result = await converter.convertSQLToES(text);
			// 创建一个选择整个文档的选择
			const selection = new vscode.Selection(
				new vscode.Position(0, 0),
				new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length)
			);
			await converter.insertResult(result, selection);
		} catch (error) {
			vscode.window.showErrorMessage(`Conversion failed: ${error}`);
		}
	});

	// 注册命令：转换选中的文本
	let disposableConvertSelected = vscode.commands.registerCommand('sql2es.convertSelected', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found!');
			return;
		}

		const selection = editor.selection;
		const selectedText = editor.document.getText(selection);

		if (!selectedText.trim()) {
			vscode.window.showErrorMessage('No text selected!');
			return;
		}

		try {
			const result = await converter.convertSQLToES(selectedText);
			await converter.insertResult(result, selection);
		} catch (error) {
			vscode.window.showErrorMessage(`Conversion failed: ${error}`);
		}
	});

	// 注册命令：将选中的SQL转换为curl命令
	let disposableConvertToCurl = vscode.commands.registerCommand('sql2es.convertToCurl', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found!');
			return;
		}

		const selection = editor.selection;
		const selectedText = editor.document.getText(selection);

		if (!selectedText.trim()) {
			vscode.window.showErrorMessage('No text selected!');
			return;
		}

		try {
			const curlCommand = await converter.convertSQLToCurl(selectedText);
			await converter.insertCurlResult(curlCommand, selection);
		} catch (error) {
			vscode.window.showErrorMessage(`Conversion failed: ${error}`);
		}
	});

	context.subscriptions.push(disposableConvert);
	context.subscriptions.push(disposableConvertSelected);
	context.subscriptions.push(disposableConvertToCurl);
}

export function deactivate() {
	console.log('SQL to ES extension is now deactivated!');
}