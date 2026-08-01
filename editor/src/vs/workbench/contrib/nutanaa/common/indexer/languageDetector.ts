/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';

export class LanguageDetector {
	private static readonly EXTENSION_MAP: Record<string, string> = {
		ts: 'typescript',
		tsx: 'typescriptreact',
		js: 'javascript',
		jsx: 'javascriptreact',
		py: 'python',
		go: 'go',
		rs: 'rust',
		java: 'java',
		c: 'c',
		cpp: 'cpp',
		h: 'c',
		hpp: 'cpp',
		cs: 'csharp',
		php: 'php',
		rb: 'ruby',
		swift: 'swift',
		kt: 'kotlin',
		html: 'html',
		css: 'css',
		json: 'json',
		yaml: 'yaml',
		yml: 'yaml',
		md: 'markdown',
		sql: 'sql',
		sh: 'shellscript',
		dockerfile: 'dockerfile'
	};

	public static detect(uri: URI): string {
		const path = uri.path.toLowerCase();
		if (path.endsWith('dockerfile')) {
			return 'dockerfile';
		}
		const parts = path.split('.');
		if (parts.length > 1) {
			const ext = parts[parts.length - 1];
			return this.EXTENSION_MAP[ext] || 'plaintext';
		}
		return 'plaintext';
	}
}
