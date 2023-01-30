import * as vscode from 'vscode';

export class WebviewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "astro.houston";

	public pose = "default";
	private _view?: vscode.WebviewView;

	constructor(private readonly _extensionUri: vscode.Uri) {}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri],
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		// webviewView.webview.onDidReceiveMessage(data => {
		// 	switch (data.type) {
		// 		case 'colorSelected':
		// 			{
		// 				vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(`#${data.value}`));
		// 				break;
		// 			}
		// 	}
		// });
	}

	public setPose(pose: string) {
		if (this._view) {
			this._view.webview.postMessage({ type: "pose", pose });
			this.pose = pose;
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Do the same for the stylesheet.
		const styleResetUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, "assets", "webview", "reset.css")
		);
		const styleMainUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, "assets", "webview", "main.css")
		);
		const webviewUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, "dist", "node", "webview.js")
		);

		// Use a nonce to only allow a specific script to be run.
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading styles from our extension directory,
					and only allow scripts that have a specific nonce.
					(See the 'webview-sample' extension sample for img-src content security policy examples)
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src https://round-shape-acdb.pika.workers.dev/ask; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">

				<title>Houston</title>
			</head>
			<body>
				<header>
					<hey-houston class="glow">
						<div class="container">
							<div class="body">
							<div class="face">
								<div class="eye" data-shape="circle"></div>
								<div class="mouth" data-shape="half-up"></div>
								<div class="eye" data-shape="circle"></div>
							</div>
							</div>
						</div>
					</hey-houston>
				</header>
				<main>
					<ul class="messages">
					</ul>
				</main>
				<footer>
					<form id="message" action="#"></form>
					<vscode-text-area form="message" name="question" placeholder="How do I setup Tailwind?"></vscode-text-area>
					<vscode-button form="message" type="submit" appearance="secondary">Send</vscode-button>
				</footer>

				<script type="module" nonce="${nonce}" src="${webviewUri}"></script>
			</body>
		</html>`;
	}
}

function getNonce() {
	let text = "";
	const possible =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
