/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMemoryEntry } from '../../models/memoryModel.js';

export class MemoryCleanup {
	public static prune(entries: IMemoryEntry[], maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): IMemoryEntry[] {
		const now = Date.now();
		return entries.filter(entry => {
			const age = now - entry.lastAccessedTimestamp;
			return age <= maxAgeMs;
		});
	}
}
