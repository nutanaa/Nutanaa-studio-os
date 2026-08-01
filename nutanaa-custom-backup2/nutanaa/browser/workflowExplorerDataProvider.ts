/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { ITreeItem, ITreeViewDataProvider, TreeItemCollapsibleState } from '../../../common/views.js';

export class WorkflowExplorerDataProvider extends Disposable implements ITreeViewDataProvider {

	constructor() {
		super();
	}

	async getChildren(element?: ITreeItem): Promise<readonly ITreeItem[] | undefined> {

		if (element) {

			switch (element.handle) {

				case 'wf-code':
					return [
						{
							handle: 'wf-typescript',
							label: { label: 'TypeScript Generation' },
							collapsibleState: TreeItemCollapsibleState.None
						},
						{
							handle: 'wf-python',
							label: { label: 'Python Generation' },
							collapsibleState: TreeItemCollapsibleState.None
						}
					];

				case 'wf-movie':
					return [
						{
							handle: 'wf-preproduction',
							label: { label: 'Pre Production' },
							collapsibleState: TreeItemCollapsibleState.None
						},
						{
							handle: 'wf-production',
							label: { label: 'Production' },
							collapsibleState: TreeItemCollapsibleState.None
						},
						{
							handle: 'wf-postproduction',
							label: { label: 'Post Production' },
							collapsibleState: TreeItemCollapsibleState.None
						}
					];
			}

			return [];
		}

		return [
			{
				handle: 'wf-code',
				label: { label: 'Code Workflows' },
				collapsibleState: TreeItemCollapsibleState.Collapsed
			},
			{
				handle: 'wf-movie',
				label: { label: 'Movie Studio Workflows' },
				collapsibleState: TreeItemCollapsibleState.Collapsed
			}
		];
	}
}
