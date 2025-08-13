import * as vscode from 'vscode';
import { SQLToESConverter } from './converter';
import { Localize, ErrorKeys } from './localize';
import { ConfigManager } from './config';

export function activate(context: vscode.ExtensionContext) {
	console.log('SQL to ES extension is now active!');

	const configManager = new ConfigManager();
	const converter = new SQLToESConverter(configManager);

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
		} catch (error) {
			vscode.window.showErrorMessage(Localize.localize(ErrorKeys.conversionFailed, error));
		}
	});

	context.subscriptions.push(disposableConvertSelected);
	context.subscriptions.push(disposableConvertToCurl);
}

export function deactivate() {
	console.log('SQL to ES extension is now deactivated!');
}