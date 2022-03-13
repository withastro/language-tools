import { ConfigManager } from '../../core/config';
import { Plugin } from '../interfaces';

export class TypeScriptPlugin implements Plugin {
	__name = 'typescript';

	private configManager: ConfigManager;

	constructor(configManager: ConfigManager) {
		this.configManager = configManager;
	}
}
