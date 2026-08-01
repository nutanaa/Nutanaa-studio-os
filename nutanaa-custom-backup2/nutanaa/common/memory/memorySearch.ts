// File: src/vs/workbench/contrib/nutanaa/common/memory/memorySearch.ts

import { IMemoryEntry, IMemoryQuery, IMemorySearchResult } from '../../models/memoryModel.js';

export class MemorySearch {
	public static query(entries: IMemoryEntry[], query: IMemoryQuery): IMemorySearchResult[] {
		const terms = query.query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
		const minScore = query.minScore ?? 0.1;
		const results: IMemorySearchResult[] = [];

		for (const entry of entries) {
			if (query.types && query.types.length > 0 && !query.types.includes(entry.type)) {
				continue;
			}

			if (query.tags && query.tags.length > 0) {
				const hasTag = query.tags.some(tag => entry.tags.includes(tag));
				if (!hasTag) {
					continue;
				}
			}

			let score = 0;
			const text = `${entry.key} ${entry.content} ${entry.tags.join(' ')}`.toLowerCase();

			for (const term of terms) {
				if (text.includes(term)) {
					score += 0.3;
				}
			}

			if (score >= minScore) {
				results.push({ entry, relevanceScore: Math.min(score, 1.0) });
			}
		}

		results.sort((a, b) => b.relevanceScore - a.relevanceScore);

		if (query.limit && query.limit > 0) {
			return results.slice(0, query.limit);
		}

		return results;
	}
}