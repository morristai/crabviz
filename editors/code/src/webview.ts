import * as vscode from 'vscode';

export class CallGraphPanel {
	public static readonly viewType = 'crabviz.callgraph';

	public static currentPanel: CallGraphPanel | null = null;
	private static num = 1;

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	public constructor(extensionUri: vscode.Uri) {
		this._extensionUri = extensionUri;

		const panel = vscode.window.createWebviewPanel(CallGraphPanel.viewType, `Crabviz #${CallGraphPanel.num}`, vscode.ViewColumn.One, {
			localResourceRoots: [
				vscode.Uri.joinPath(this._extensionUri, 'media')
			],
			enableScripts: true
		});

		panel.iconPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'icon.svg');

		this._panel = panel;

		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'saveImage':
						this.saveSVG(message.svg);

						break;
				}
			},
			null,
			this._disposables
		);

		this._panel.onDidChangeViewState(
			e => {
				if (panel.active) {
					CallGraphPanel.currentPanel = this;
				} else if (CallGraphPanel.currentPanel !== this) {
					return;
				} else {
					CallGraphPanel.currentPanel = null;
				}
			},
			null,
			this._disposables
		);

		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		CallGraphPanel.num += 1;
	}

	public dispose() {
		if (CallGraphPanel.currentPanel === this) {
			CallGraphPanel.currentPanel = null;
		}

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	public showCallGraph(svg: string, focusMode: boolean) {
		const resourceUri = vscode.Uri.joinPath(this._extensionUri, 'media');

		const variables = 'variables.css';
		const variablesCssPath = vscode.Uri.joinPath(resourceUri, variables);
		const stylesPath = vscode.Uri.joinPath(resourceUri, 'styles.css');
		const graphJsPath = vscode.Uri.joinPath(resourceUri, 'graph.js');
		const panZoomJsPath = vscode.Uri.joinPath(resourceUri, 'panzoom.min.js');
		const exportJsPath = vscode.Uri.joinPath(resourceUri, 'export.js');

		const webview = this._panel.webview;
		const variablesCssUri = webview.asWebviewUri(variablesCssPath);
		const stylesUri = webview.asWebviewUri(stylesPath);
		const graphJsUri = webview.asWebviewUri(graphJsPath);
		const panZoomJsUri = webview.asWebviewUri(panZoomJsPath);
		const exportJsUri = webview.asWebviewUri(exportJsPath);

		CallGraphPanel.currentPanel = this;

		const nonce = getNonce();

		this._panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
		<meta charset="UTF-8">
		<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<link rel="stylesheet" href="${variablesCssUri}">
		<link rel="stylesheet" href="${stylesUri}">
		<script nonce="${nonce}" src="${panZoomJsUri}"></script>
		<script nonce="${nonce}" src="${exportJsUri}"></script>
		<script nonce="${nonce}" src="${graphJsUri}"></script>
		<title>crabviz</title>
</head>
<body data-vscode-context='{ "preventDefaultContextMenuItems": true }'>
		${svg}

		<script nonce="${nonce}">
			const graph = new CallGraph(document.querySelector("svg"), ${focusMode});
			graph.activate();

			panzoom(graph.svg, {
				maxZoom: 10,
				minZoom: 1,
				smoothScroll: false,
				zoomDoubleClickSpeed: 1
			});
		</script>
</body>
</html>`;
	}

	public exportSVG() {
		this._panel.webview.postMessage({ command: 'export' });
	}

	saveSVG(svg: string) {
		const writeData = Buffer.from(svg, 'utf8');

		vscode.window.showSaveDialog({
			saveLabel: "export",
			filters: { 'Images': ['svg'] },
		}).then((fileUri) => {
			if (fileUri) {
				try {
					vscode.workspace.fs.writeFile(fileUri, writeData)
						.then(() => {
							console.log("File Saved");
						}, (err : any) => {
							vscode.window.showErrorMessage(`Error on writing file: ${err}`);
						});
				} catch (err) {
					vscode.window.showErrorMessage(`Error on writing file: ${err}`);
				}
			}
		});
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
