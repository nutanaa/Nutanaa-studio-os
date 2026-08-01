/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';
import { IDependencyNode } from '../../models/workspaceModel.js';

export class DependencyAnalyzer {
	private readonly dependencyMap: Map<string, IDependencyNode> = new Map();

	public analyzeFile(uri: URI, imports: string[], exports: string[]): IDependencyNode {
		const key = uri.toString();
		const internalDependencies: string[] = [];
		const externalDependencies: string[] = [];

		for (const imp of imports) {
			if (imp.startsWith('.') || imp.startsWith('/')) {
				internalDependencies.push(imp);
			} else {
				externalDependencies.push(imp);
			}
		}

		const node: IDependencyNode = {
			id: key,
			uri,
			imports,
			exports,
			internalDependencies,
			externalDependencies
		};

		this.dependencyMap.set(key, node);
		return node;
	}

	public getDependencyGraph(): IDependencyNode[] {
		return Array.from(this.dependencyMap.values());
	}

	public getDependenciesFor(uri: URI): IDependencyNode | undefined {
		return this.dependencyMap.get(uri.toString());
	}

	public removeFile(uri: URI): void {
		this.dependencyMap.delete(uri.toString());
	}
}
