import * as http from 'http';
import { WorkspaceFolder } from 'vscode';
import load from '@proload/core';

export async function getCurrentServer(workspaceDir?: WorkspaceFolder | undefined): Promise<string | undefined> {
	if (workspaceDir) {
		let astroConfig;

		try {
			astroConfig = await load('astro', { cwd: workspaceDir.uri.fsPath });
		} catch (e) {
			console.error("Couldn't load Astro config: ", e);
		}

		const initialPort = astroConfig?.value.server?.port ?? 3000;
		const port = await getLocalhostPort(initialPort);

		if (port) {
			return `http://localhost:${port}/`;
		}
	} else {
		// If we don't have a workspace, we can't know which port the user has chosen to run the dev server on
		// As such, we'll instead try to find starting from Astro's default port. This should work just fine in most cases
		const port = await getLocalhostPort(3000);

		if (port) {
			return `http://localhost:${port}/`;
		}
	}

	return undefined;
}

export async function isLocalhostUsingPort(port: number) {
	return new Promise<boolean>((resolve) => {
		http
			.get(
				`http://localhost:${port}/`,
				{
					headers: {
						accept: '*/*',
					},
				},
				(res) => {
					resolve(res.statusCode === 200);
				}
			)
			.on('error', () => resolve(false))
			.end();
	});
}

async function getLocalhostPort(port: number) {
	if (await isLocalhostUsingPort(port)) {
		return port;
	}
	port++;
}

export async function sleep(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}
