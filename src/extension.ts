import * as vscode from 'vscode';
import { SQLToESConverter } from './converter';
import { Localize, ErrorKeys, HistoryKeys } from './localize';
import { ConfigManager } from './config';
import { HistoryManager, ConversionHistoryItem } from './historyManager';

export function activate(context: vscode.ExtensionContext) {
	console.log('SQL to ES extension is now active!');

	// 初始化本地化
	Localize.initialize(context);

	const configManager = new ConfigManager();
	const converter = new SQLToESConverter(configManager);
	const historyManager = new HistoryManager(context);

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
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(Localize.localize(ErrorKeys.conversionFailed, errorMessage));
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
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(Localize.localize(ErrorKeys.conversionFailed, errorMessage));
		}
	});

	// 注册命令：查看转换历史
	let disposableViewHistory = vscode.commands.registerCommand('sql2es.viewHistory', async () => {
		try {
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

			// 设置webview HTML内容（不包含数据和翻译）
			panel.webview.html = getWebviewContent();

			// 加载并发送历史记录数据
			await loadAndSendHistory(panel, historyManager);

			// 监听webview消息
			panel.webview.onDidReceiveMessage(async message => {
				switch (message.command) {
					case 'copySQL':
						await handleCopySQL(message.id, historyManager, panel);
						break;
					case 'copyResult':
						await handleCopyResult(message.id, historyManager, panel);
						break;
					case 'confirmDelete':
						await handleConfirmDelete(message.id, historyManager, panel);
						break;
					case 'changePage':
						await handleChangePage(message.page, panel, historyManager);
						break;
					case 'viewSQL':
						await handleViewSQL(message.id, historyManager);
						break;
					case 'viewResult':
						await handleViewResult(message.id, historyManager);
						break;
					case 'refresh':
						await loadAndSendHistory(panel, historyManager);
						break;
					case 'editResult':
						await handleEditResult(message.id, message.data, historyManager, panel);
						break;
					case 'getRecordForEdit':
						await handleGetRecordForEdit(message.id, historyManager, panel);
						break;
				}
			}, undefined, context.subscriptions);

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(Localize.localize(ErrorKeys.conversionFailed, errorMessage));
		}
	});

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
				const errorMessage = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(Localize.localize(ErrorKeys.conversionFailed, errorMessage));
			}
		}
	});

	context.subscriptions.push(disposableConvertSelected);
	context.subscriptions.push(disposableConvertToCurl);
	context.subscriptions.push(disposableViewHistory);
	context.subscriptions.push(disposableClearHistory);
}

/**
 * 加载历史记录和翻译并发送到 WebView
 */
async function loadAndSendHistory(
	panel: vscode.WebviewPanel,
	historyManager: HistoryManager
): Promise<void> {
	const history = await historyManager.getConversionHistory();
	const translations = Localize.getWebviewTranslations();
	panel.webview.postMessage({
		command: 'init',
		data: history,
		translations: translations
	});
}

/**
 * 处理复制 SQL
 */
async function handleCopySQL(
	id: string,
	historyManager: HistoryManager,
	panel: vscode.WebviewPanel
): Promise<void> {
	const history = await historyManager.getConversionHistory();
	const item = history.find(h => h.id === id);
	if (item) {
		await vscode.env.clipboard.writeText(item.sqlQuery);
		panel.webview.postMessage({ command: 'showNotification', text: 'SQL copied to clipboard' });
	}
}

/**
 * 处理复制结果
 */
async function handleCopyResult(
	id: string,
	historyManager: HistoryManager,
	panel: vscode.WebviewPanel
): Promise<void> {
	const history = await historyManager.getConversionHistory();
	const item = history.find(h => h.id === id);
	if (item) {
		const resultText = item.type === 'dsl'
			? (item.apiPath ? item.apiPath + '\n\n' : '') + (item.esQuery || '')
			: item.curlCommand || '';
		await vscode.env.clipboard.writeText(resultText);
		panel.webview.postMessage({ command: 'showNotification', text: 'Result copied to clipboard' });
	}
}

/**
 * 处理确认删除
 */
async function handleConfirmDelete(
	id: string,
	historyManager: HistoryManager,
	panel: vscode.WebviewPanel
): Promise<void> {
	const deleteConfirmed = await vscode.window.showInformationMessage(
		'Are you sure you want to delete this record?',
		{ modal: true },
		'Yes',
		'No'
	);
	if (deleteConfirmed === 'Yes') {
		await historyManager.deleteConversionHistory(id);
		await loadAndSendHistory(panel, historyManager);
		panel.webview.postMessage({ command: 'showNotification', text: 'Record deleted' });
	}
}

/**
 * 处理分页
 */
async function handleChangePage(
	page: number,
	panel: vscode.WebviewPanel,
	historyManager: HistoryManager
): Promise<void> {
	const history = await historyManager.getConversionHistory();
	panel.webview.postMessage({
		command: 'loadHistory',
		data: history,
		page: page
	});
}

/**
 * 处理查看 SQL
 */
async function handleViewSQL(id: string, historyManager: HistoryManager): Promise<void> {
	const history = await historyManager.getConversionHistory();
	const item = history.find(h => h.id === id);
	if (item) {
		const doc = await vscode.workspace.openTextDocument({
			content: item.sqlQuery,
			language: 'sql'
		});
		await vscode.window.showTextDocument(doc, { preview: false });
	}
}

/**
 * 处理查看结果
 */
async function handleViewResult(id: string, historyManager: HistoryManager): Promise<void> {
	const history = await historyManager.getConversionHistory();
	const item = history.find(h => h.id === id);
	if (item) {
		const content = item.type === 'dsl'
			? (item.apiPath ? item.apiPath + '\n\n' : '') + (item.esQuery || '')
			: item.curlCommand || '';
		const doc = await vscode.workspace.openTextDocument({
			content: content,
			language: item.type === 'dsl' ? 'json' : 'shellscript'
		});
		await vscode.window.showTextDocument(doc, { preview: false });
	}
}

/**
 * 处理获取记录用于编辑
 */
async function handleGetRecordForEdit(
	id: string,
	historyManager: HistoryManager,
	panel: vscode.WebviewPanel
): Promise<void> {
	const history = await historyManager.getConversionHistory();
	const item = history.find(h => h.id === id);
	if (item) {
		const resultText = item.type === 'dsl'
			? (item.apiPath ? item.apiPath + '\n\n' : '') + (item.esQuery || '')
			: item.curlCommand || '';
		panel.webview.postMessage({
			command: 'showEditModal',
			id: id,
			data: resultText,
			type: item.type
		});
	}
}

/**
 * 处理编辑结果
 */
async function handleEditResult(
	id: string,
	data: string,
	historyManager: HistoryManager,
	panel: vscode.WebviewPanel
): Promise<void> {
	const history = await historyManager.getConversionHistory();
	const item = history.find(h => h.id === id);
	if (!item) return;

	let updateFields: Partial<ConversionHistoryItem> = {};

	if (item.type === 'dsl') {
		// 对于DSL类型，分割API路径和查询部分
		const lines = data.split('\n\n');
		if (lines.length > 1) {
			updateFields.apiPath = lines[0].trim();
			updateFields.esQuery = lines.slice(1).join('\n').trim();
		} else {
			updateFields.esQuery = data.trim();
		}
	} else {
		// 对于Curl类型，直接更新命令
		updateFields.curlCommand = data;
	}

	const success = await historyManager.updateSingleConversionHistory(id, updateFields);
	if (success) {
		await loadAndSendHistory(panel, historyManager);
		panel.webview.postMessage({
			command: 'showNotification',
			text: 'Record updated successfully'
		});
	}
}

/**
 * 生成 WebView HTML 内容
 * 翻译字符串通过 postMessage 传递
 */
function getWebviewContent(): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>SQL2ES Conversion History</title>
	<style>
		* { box-sizing: border-box; }
		body {
			font-family: var(--vscode-font-family);
			background-color: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			padding: 20px;
			margin: 0;
		}
		h1 {
			margin-bottom: 20px;
			font-size: 1.5em;
		}
		.toolbar {
			margin-bottom: 15px;
			display: flex;
			gap: 10px;
			align-items: center;
		}
		.search-box {
			flex: 1;
			max-width: 300px;
		}
		.search-box input {
			width: 100%;
			padding: 6px 10px;
			border: 1px solid var(--vscode-input-border);
			background-color: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border-radius: 3px;
		}
		.filter-select {
			padding: 6px 10px;
			border: 1px solid var(--vscode-input-border);
			background-color: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border-radius: 3px;
		}
		table {
			width: 100%;
			border-collapse: collapse;
			font-size: 13px;
		}
		th, td {
			padding: 10px;
			text-align: left;
			border-bottom: 1px solid var(--vscode-editorGroupHeader-tabsBorder);
		}
		th {
			background-color: var(--vscode-list-hoverBackground);
			font-weight: 600;
		}
		tr:hover {
			background-color: var(--vscode-list-hoverBackground);
		}
		.sql-cell {
			max-width: 300px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.type-badge {
			display: inline-block;
			padding: 2px 8px;
			border-radius: 3px;
			font-size: 11px;
			font-weight: 600;
		}
		.type-badge.dsl {
			background-color: var(--vscode-charts-blue);
			color: white;
		}
		.type-badge.curl {
			background-color: var(--vscode-charts-green);
			color: white;
		}
		.actions {
			display: flex;
			gap: 5px;
			flex-wrap: wrap;
		}
		.btn {
			padding: 4px 8px;
			border: none;
			border-radius: 3px;
			cursor: pointer;
			font-size: 11px;
			background-color: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}
		.btn:hover {
			background-color: var(--vscode-button-hoverBackground);
		}
		/* Element UI 配色方案 */
		.btn-danger {
			background-color: #F56C6C;
			color: white;
		}
		.btn-danger:hover {
			background-color: #f78989;
		}
		.btn-warning {
			background-color: #E6A23C;
			color: white;
		}
		.btn-warning:hover {
			background-color: #ebb563;
		}
		.btn:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
		.pagination {
			margin-top: 20px;
			display: flex;
			justify-content: center;
			align-items: center;
			gap: 15px;
		}
		.empty-state {
			text-align: center;
			padding: 60px 20px;
			color: var(--vscode-descriptionForeground);
		}
		.loading {
			text-align: center;
			padding: 40px;
			color: var(--vscode-descriptionForeground);
		}
		.hidden {
			display: none;
		}
		/* Edit Modal Styles */
		.modal-overlay {
			display: none;
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background-color: rgba(0, 0, 0, 0.5);
			z-index: 1000;
			justify-content: center;
			align-items: center;
		}
		.modal-overlay.active {
			display: flex;
		}
		.modal-content {
			background-color: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
			border-radius: 6px;
			width: 80%;
			max-width: 800px;
			max-height: 80vh;
			display: flex;
			flex-direction: column;
		}
		.modal-header {
			padding: 15px 20px;
			border-bottom: 1px solid var(--vscode-panel-border);
			display: flex;
			justify-content: space-between;
			align-items: center;
		}
		.modal-header h2 {
			margin: 0;
			font-size: 1.2em;
		}
		.modal-body {
			padding: 20px;
			flex: 1;
			overflow: hidden;
			display: flex;
			flex-direction: column;
		}
		.modal-body textarea {
			width: 100%;
			flex: 1;
			min-height: 200px;
			padding: 10px;
			border: 1px solid var(--vscode-input-border);
			background-color: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border-radius: 3px;
			font-family: var(--vscode-editor-font-family);
			font-size: var(--vscode-editor-font-size);
			resize: none;
		}
		.modal-footer {
			padding: 15px 20px;
			border-top: 1px solid var(--vscode-panel-border);
			display: flex;
			justify-content: flex-end;
			gap: 10px;
		}
		.btn-secondary {
			background-color: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
		}
		.btn-secondary:hover {
			background-color: var(--vscode-button-secondaryHoverBackground);
		}
		.edit-hint {
			margin-top: 8px;
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
		}
	</style>
</head>
<body>
	<div class="toolbar">
		<div class="search-box">
			<input type="text" id="searchInput" placeholder="Search SQL...">
		</div>
		<select class="filter-select" id="typeFilter">
			<option value="">All Types</option>
			<option value="dsl">DSL</option>
			<option value="curl">Curl</option>
		</select>
		<button class="btn" id="refreshBtn">Refresh</button>
	</div>

	<div id="loadingState" class="loading">Loading history...</div>
	<div id="emptyState" class="empty-state hidden">No conversion history records found.</div>
	<div id="contentState" class="hidden">
		<table id="historyTable">
			<thead>
				<tr>
					<th id="colSQL">SQL Query</th>
					<th id="colType">Type</th>
					<th id="colDate">Date</th>
					<th id="colActions">Actions</th>
				</tr>
			</thead>
			<tbody id="tableBody">
			</tbody>
		</table>
		<div class="pagination" id="pagination">
			<button class="btn" id="prevBtn">Previous</button>
			<span id="pageInfo"></span>
			<button class="btn" id="nextBtn">Next</button>
		</div>
	</div>

	<!-- Edit Modal -->
	<div id="editModal" class="modal-overlay">
		<div class="modal-content">
			<div class="modal-header">
				<h2 id="editTitle">Edit Conversion Result</h2>
			</div>
			<div class="modal-body">
				<textarea id="editTextarea"></textarea>
				<div class="edit-hint" id="editHint"></div>
			</div>
			<div class="modal-footer">
				<button class="btn btn-secondary" id="editCancelBtn">Cancel</button>
				<button class="btn" id="editSaveBtn">Save</button>
			</div>
		</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		
		let allHistory = [];
		let filteredHistory = [];
		let currentPage = 1;
		const itemsPerPage = 10;
		let i18n = {};
		let currentEditId = null;
		
		// 翻译函数
		function t(key) {
			return i18n[key] || key;
		}
		
		function formatDate(timestamp) {
			return new Date(timestamp).toLocaleString();
		}
		
		function applyTranslations() {
			document.getElementById('searchInput').placeholder = t('history.webview.searchPlaceholder');
			document.getElementById('typeFilter').options[0].textContent = t('history.webview.filterAll');
			document.getElementById('typeFilter').options[1].textContent = t('history.webview.filterDSL');
			document.getElementById('typeFilter').options[2].textContent = t('history.webview.filterCurl');
			document.getElementById('refreshBtn').textContent = t('history.webview.refresh');
			document.getElementById('loadingState').textContent = t('history.webview.loading');
			document.getElementById('emptyState').textContent = t('history.webview.empty');
			document.getElementById('colSQL').textContent = t('history.webview.colSQL');
			document.getElementById('colType').textContent = t('history.webview.colType');
			document.getElementById('colDate').textContent = t('history.webview.colDate');
			document.getElementById('colActions').textContent = t('history.webview.colActions');
			document.getElementById('prevBtn').textContent = t('history.webview.prev');
			document.getElementById('nextBtn').textContent = t('history.webview.next');
			document.getElementById('editTitle').textContent = t('history.webview.editTitle');
			document.getElementById('editCancelBtn').textContent = t('history.webview.editCancel');
			document.getElementById('editSaveBtn').textContent = t('history.webview.editSave');
		}
		
		function renderTable() {
			const tableBody = document.getElementById('tableBody');
			const emptyState = document.getElementById('emptyState');
			const contentState = document.getElementById('contentState');
			const loadingState = document.getElementById('loadingState');
			
			loadingState.classList.add('hidden');
			
			if (filteredHistory.length === 0) {
				emptyState.classList.remove('hidden');
				contentState.classList.add('hidden');
				return;
			}
			
			emptyState.classList.add('hidden');
			contentState.classList.remove('hidden');
			
			const startIndex = (currentPage - 1) * itemsPerPage;
			const endIndex = Math.min(startIndex + itemsPerPage, filteredHistory.length);
			const pageItems = filteredHistory.slice(startIndex, endIndex);
			
			tableBody.innerHTML = pageItems.map(item => \`
				<tr data-id="\${item.id}">
					<td class="sql-cell" title="\${escapeHtml(item.sqlQuery)}">\${escapeHtml(item.sqlQuery)}</td>
					<td><span class="type-badge \${item.type}">\${item.type.toUpperCase()}</span></td>
					<td>\${formatDate(item.timestamp)}</td>
					<td class="actions">
						<button class="btn" data-action="viewSQL" data-id="\${item.id}">\${t('history.action.viewSQL')}</button>
						<button class="btn" data-action="viewResult" data-id="\${item.id}">\${t('history.action.viewResult')}</button>
						<button class="btn" data-action="copySQL" data-id="\${item.id}">\${t('history.action.copySQL')}</button>
						<button class="btn" data-action="copyResult" data-id="\${item.id}">\${t('history.action.copyResult')}</button>
						<button class="btn btn-warning" data-action="edit" data-id="\${item.id}">\${t('history.webview.editResult')}</button>
						<button class="btn btn-danger" data-action="delete" data-id="\${item.id}">\${t('history.webview.delete')}</button>
					</td>
				</tr>
			\`).join('');
			
			updatePagination();
		}
		
		function updatePagination() {
			const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
			const prevBtn = document.getElementById('prevBtn');
			const nextBtn = document.getElementById('nextBtn');
			const pageInfo = document.getElementById('pageInfo');
			
			const pageText = t('history.webview.pageInfo')
				.replace('{0}', currentPage)
				.replace('{1}', totalPages || 1);
			pageInfo.textContent = pageText;
			
			prevBtn.disabled = currentPage <= 1;
			nextBtn.disabled = currentPage >= totalPages || totalPages === 0;
		}
		
		function escapeHtml(text) {
			const div = document.createElement('div');
			div.textContent = text;
			return div.innerHTML;
		}
		
		function applyFilter() {
			const searchTerm = document.getElementById('searchInput').value.toLowerCase();
			const typeFilter = document.getElementById('typeFilter').value;
			
			filteredHistory = allHistory.filter(item => {
				const matchesSearch = item.sqlQuery.toLowerCase().includes(searchTerm);
				const matchesType = !typeFilter || item.type === typeFilter;
				return matchesSearch && matchesType;
			});
			
			currentPage = 1;
			renderTable();
		}
		
		document.getElementById('searchInput').addEventListener('input', applyFilter);
		document.getElementById('typeFilter').addEventListener('change', applyFilter);
		
		document.getElementById('prevBtn').addEventListener('click', () => {
			if (currentPage > 1) {
				currentPage--;
				renderTable();
			}
		});
		
		document.getElementById('nextBtn').addEventListener('click', () => {
			const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
			if (currentPage < totalPages) {
				currentPage++;
				renderTable();
			}
		});
		
		document.getElementById('refreshBtn').addEventListener('click', () => {
			document.getElementById('loadingState').classList.remove('hidden');
			document.getElementById('contentState').classList.add('hidden');
			document.getElementById('emptyState').classList.add('hidden');
			vscode.postMessage({ command: 'refresh' });
		});
		
		// Edit Modal Functions
		function openEditModal(id, data, type) {
			currentEditId = id;
			document.getElementById('editTextarea').value = data;
			
			// Show hint for DSL type
			const hintEl = document.getElementById('editHint');
			if (type === 'dsl') {
				hintEl.textContent = 'Tip: For DSL queries, separate API path and query body with a blank line';
			} else {
				hintEl.textContent = '';
			}
			
			document.getElementById('editModal').classList.add('active');
		}
		
		function closeEditModal() {
			currentEditId = null;
			document.getElementById('editModal').classList.remove('active');
			document.getElementById('editTextarea').value = '';
		}
		
		function saveEdit() {
			if (!currentEditId) return;
			
			const data = document.getElementById('editTextarea').value;
			vscode.postMessage({
				command: 'editResult',
				id: currentEditId,
				data: data
			});
			closeEditModal();
		}
		
		document.getElementById('editCancelBtn').addEventListener('click', closeEditModal);
		document.getElementById('editSaveBtn').addEventListener('click', saveEdit);
		
		// Close modal when clicking overlay
		document.getElementById('editModal').addEventListener('click', (e) => {
			if (e.target.id === 'editModal') {
				closeEditModal();
			}
		});
		
		document.getElementById('tableBody').addEventListener('click', (e) => {
			const btn = e.target.closest('[data-action]');
			if (!btn) return;
			
			const action = btn.dataset.action;
			const id = btn.dataset.id;
			
			switch (action) {
				case 'copySQL':
					vscode.postMessage({ command: 'copySQL', id });
					break;
				case 'copyResult':
					vscode.postMessage({ command: 'copyResult', id });
					break;
				case 'viewSQL':
					vscode.postMessage({ command: 'viewSQL', id });
					break;
				case 'viewResult':
					vscode.postMessage({ command: 'viewResult', id });
					break;
				case 'edit':
					vscode.postMessage({ command: 'getRecordForEdit', id });
					break;
				case 'delete':
					vscode.postMessage({ command: 'confirmDelete', id });
					break;
			}
		});
		
		window.addEventListener('message', event => {
			const message = event.data;
			switch (message.command) {
				case 'init':
					i18n = message.translations || {};
					applyTranslations();
					allHistory = message.data || [];
					applyFilter();
					break;
				case 'loadHistory':
					allHistory = message.data || [];
					applyFilter();
					break;
				case 'showEditModal':
					openEditModal(message.id, message.data, message.type);
					break;
				case 'showNotification':
					const notification = document.createElement('div');
					notification.style.cssText = \`
						position: fixed;
						top: 20px;
						right: 20px;
						background: var(--vscode-notifications-background);
						color: var(--vscode-notifications-foreground);
						padding: 10px 20px;
						border-radius: 4px;
						box-shadow: 0 2px 8px rgba(0,0,0,0.3);
						z-index: 1000;
					\`;
					notification.textContent = message.text;
					document.body.appendChild(notification);
					setTimeout(() => notification.remove(), 2000);
					break;
			}
		});
	</script>
</body>
</html>`;
}

export function deactivate() {
	console.log('SQL to ES extension is now deactivated!');
}
