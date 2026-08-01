// File: src/vs/workbench/contrib/nutanaa/common/memory/memoryCompression.ts

import { IMemoryEntry } from '../../models/memoryModel.js';

export class MemoryCompression {
	public static compressConversation(entries: IMemoryEntry[]): IMemoryEntry {
		const summaryText = entries
			.map(e => e.content)
			.join('\n')
			.substring(0, 500);

		const now = Date.now();
		return {
			id: `compressed_conv_${now}`,
			type: 'conversation',
			key: 'compressed_summary',
			content: `Summary of ${entries.length} turns: ${summaryText}...`,
			tags: ['summary', 'compressed'],
			timestamp: now,
			lastAccessedTimestamp: now,
			accessCount: 1,
			score: 1.0
		};
	}
}