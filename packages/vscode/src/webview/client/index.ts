import { provideVSCodeDesignSystem, vsCodeButton, vsCodeTextArea, TextArea, Button } from '@vscode/webview-ui-toolkit';
import './houston.js';
import { makeAskRequest  } from './api.js';

provideVSCodeDesignSystem().register([vsCodeButton(), vsCodeTextArea()]);
const houston = document.querySelector('hey-houston') as any;
const messages = document.querySelector('main > ul.messages') as HTMLElement;

async function submit(question: string) {
	const thinking = houston.think();
	const res = await makeAskRequest(question);
	thinking.stop();
	const li = document.createElement('li');
	li.textContent = res.answer;
	messages.appendChild(li)
}

function main() {
	const form = document.querySelector('form#message')!;
	const questionEl = document.querySelector('vscode-text-area') as TextArea;
	const submitEl = document.querySelector('vscode-button[type="submit"]') as Button;
	// @ts-ignore
	const vscode = acquireVsCodeApi();
	
	submitEl.addEventListener('click', () => {
		const question = questionEl.value.trim();
		if (!question) return;
		submit(question);
		const li = document.createElement('li');
		li.textContent = question;
		messages.appendChild(li)
		questionEl.value = '';
		questionEl.focus();
	})

	// window.addEventListener('message', (event) => {
	// 	const message = event.data;
	// 	switch (message.type) {
	// 		case 'pose': {
	// 			// @ts-ignore
	// 			houston.setAttribute('pose', message.pose);
	// 			break;
	// 		}
	// 	}
	// });
}

main();
