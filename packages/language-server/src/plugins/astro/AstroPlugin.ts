import { ConfigManager } from '../../core/config';
import { Plugin } from '../interfaces';

export class AstroPlugin implements Plugin {
	__name = 'astro';

	private configManager: ConfigManager;

	constructor(configManager: ConfigManager) {
		this.configManager = configManager
	}
}
