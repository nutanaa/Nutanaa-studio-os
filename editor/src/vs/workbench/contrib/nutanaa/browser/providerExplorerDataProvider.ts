/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { ITreeItem, ITreeViewDataProvider, TreeItemCollapsibleState } from '../../../common/views.js';

export class ProviderExplorerDataProvider extends Disposable implements ITreeViewDataProvider {

	async getChildren(element?: ITreeItem): Promise<readonly ITreeItem[]> {

		if (element) {

			switch (element.handle) {

				case 'provider-local':
					return [
						{
							handle: 'ollama',
							label: { label: 'Ollama' },
							collapsibleState: TreeItemCollapsibleState.None
						},
						{
							handle: 'lmstudio',
							label: { label: 'LM Studio' },
							collapsibleState: TreeItemCollapsibleState.None
						}
					];

				case 'provider-cloud':
					return [
						{
							handle: 'openai',
							label: { label: 'OpenAI' },
							collapsibleState: TreeItemCollapsibleState.None
						},
						{
							handle: 'anthropic',
							label: { label: 'Anthropic' },
							collapsibleState: TreeItemCollapsibleState.None
						},
						{
							handle: 'google',
							label: { label: 'Google Gemini' },
							collapsibleState: TreeItemCollapsibleState.None
						},
						{
							handle: 'openrouter',
							label: { label: 'OpenRouter' },
							collapsibleState: TreeItemCollapsibleState.None
						},
						{
							handle: 'groq',
							label: { label: 'Groq' },
							collapsibleState: TreeItemCollapsibleState.None
						}
					];

				case 'provider-video':
					return [
						{ handle: 'veo', label: { label: 'Google Veo' }, collapsibleState: TreeItemCollapsibleState.None },
						{ handle: 'runway', label: { label: 'Runway' }, collapsibleState: TreeItemCollapsibleState.None },
						{ handle: 'kling', label: { label: 'Kling AI' }, collapsibleState: TreeItemCollapsibleState.None },
						{ handle: 'pika', label: { label: 'Pika' }, collapsibleState: TreeItemCollapsibleState.None }
					];

				case 'provider-image':
					return [
						{ handle: 'flux', label: { label: 'FLUX' }, collapsibleState: TreeItemCollapsibleState.None },
						{ handle: 'stable', label: { label: 'Stable Diffusion' }, collapsibleState: TreeItemCollapsibleState.None }
					];

				case 'provider-audio':
					return [
						{ handle: 'elevenlabs', label: { label: 'ElevenLabs' }, collapsibleState: TreeItemCollapsibleState.None },
						{ handle: 'deepgram', label: { label: 'Deepgram' }, collapsibleState: TreeItemCollapsibleState.None }
					];
			}

			return [];
		}

		return [
			{
				handle: 'provider-local',
				label: { label: 'Local Providers' },
				collapsibleState: TreeItemCollapsibleState.Collapsed
			},
			{
				handle: 'provider-cloud',
				label: { label: 'Cloud Providers' },
				collapsibleState: TreeItemCollapsibleState.Collapsed
			},
			{
				handle: 'provider-video',
				label: { label: 'Video Generation' },
				collapsibleState: TreeItemCollapsibleState.Collapsed
			},
			{
				handle: 'provider-image',
				label: { label: 'Image Generation' },
				collapsibleState: TreeItemCollapsibleState.Collapsed
			},
			{
				handle: 'provider-audio',
				label: { label: 'Voice / Audio' },
				collapsibleState: TreeItemCollapsibleState.Collapsed
			}
		];
	}
}
