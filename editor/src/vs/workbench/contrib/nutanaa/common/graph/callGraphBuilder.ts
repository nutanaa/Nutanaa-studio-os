/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICallGraphNode, IWorkspaceSymbol } from '../../models/workspaceModel.js';

export class CallGraphBuilder {
	private readonly callGraph: Map<string, ICallGraphNode> = new Map();

	public buildNode(symbol: IWorkspaceSymbol, allSymbols: IWorkspaceSymbol[], bodyContent: string): ICallGraphNode {
		const calls: string[] = [];

		for (const otherSymbol of allSymbols) {
			if (otherSymbol.id !== symbol.id && bodyContent.includes(otherSymbol.name)) {
				calls.push(otherSymbol.id);
			}
		}

		const node: ICallGraphNode = {
			symbolId: symbol.id,
			name: symbol.name,
			location: { uri: symbol.location.uri, line: symbol.location.startLine },
			calls,
			calledBy: []
		};

		this.callGraph.set(symbol.id, node);
		this.updateInboundCalls();
		return node;
	}

	private updateInboundCalls(): void {
		for (const [, node] of this.callGraph) {
			node.calledBy.length = 0;
		}

		for (const [callerId, node] of this.callGraph) {
			for (const calleeId of node.calls) {
				const calleeNode = this.callGraph.get(calleeId);
				if (calleeNode && !calleeNode.calledBy.includes(callerId)) {
					calleeNode.calledBy.push(callerId);
				}
			}
		}
	}

	public getCallGraph(): ICallGraphNode[] {
		return Array.from(this.callGraph.values());
	}

	public removeSymbol(symbolId: string): void {
		this.callGraph.delete(symbolId);
		this.updateInboundCalls();
	}
}
