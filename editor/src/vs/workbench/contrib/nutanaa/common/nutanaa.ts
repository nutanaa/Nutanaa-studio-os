/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../../base/common/event.js';
/**
 * Identifier of the Nutanaa view container that hosts all Nutanaa
 * sidebar views (Agents, Workflows, Providers, Memory, Tasks).
 */
export const NUTANAA_VIEW_CONTAINER_ID = 'workbench.view.nutanaa';

/**
 * Identifier of the Agent Explorer tree view.
 */
export const NUTANAA_AGENT_EXPLORER_VIEW_ID = 'workbench.views.nutanaa.agentExplorer';

/**
 * Base HTTP origin of the local Nutanaa Runtime backend (see `runtime/main.py`).
 * Phase 1 only: hardcoded to the default local dev port. Once the runtime
 * is packaged with the editor, or made remotely configurable, this should
 * move to a settings-backed value instead of a constant.
 */
export const NUTANAA_RUNTIME_HTTP_URL = 'http://127.0.0.1:8787';

/**
 * WebSocket URL for the Nutanaa Runtime backend's event stream.
 */
export const NUTANAA_RUNTIME_WS_URL = 'ws://127.0.0.1:8787/ws';

/**
 * Command id that refreshes the Agent Explorer view.
 */
export const NUTANAA_AGENT_EXPLORER_REFRESH_COMMAND_ID = 'nutanaa.agentExplorer.refresh';


export const enum NutanaaRuntimeConnectionState {
	/** No attempt has been made to reach the runtime backend yet. */
	Disconnected = 0,
	/** A connection attempt is in progress. */
	Connecting = 1,
	/** The editor is actively connected to a running Nutanaa Runtime process. */
	Connected = 2,
	/** The last connection attempt failed. */
	Error = 3,
}

/**
 * A single running agent as reported by the Nutanaa Runtime backend.
 *
 * Mirrors the shape produced by `runtime/agents` (see
 * `runtime/agents/registry.py` and `runtime/agents/scheduler.py` in the
 * Python runtime core) once exposed over the FastAPI/WebSocket bridge.
 */
export interface INutanaaAgentSummary {
	readonly id: string;
	readonly name: string;
	readonly role: string;
	readonly status: string;
}

/**
 * A single registered provider as reported by the Nutanaa Runtime
 * backend's `/providers` endpoint (see `runtime/providers/provider_manager.py`
 * and `backend/api/main.py`).
 */
export interface INutanaaProviderSummary {
	readonly id: string;
	readonly name: string;
	readonly type: string;
	readonly healthy: boolean;
	readonly status: string;
	readonly message: string;
	readonly models: readonly string[];
	readonly activeModel: string | undefined;
}

export const INutanaaRuntimeConnectionService = createDecorator<INutanaaRuntimeConnectionService>('nutanaaRuntimeConnectionService');

/**
 * Tracks and exposes the connection state between the Nutanaa Studio OS
 * editor and the Nutanaa Runtime backend, and provides read access to
 * runtime-reported data (agents, workflows, providers) once connected.
 *
 * This service is intentionally the single seam between the editor UI and
 * the backend: views must depend on this contract, never reach for a
 * concrete transport directly, so the eventual REST/WebSocket
 * implementation can be swapped in without touching any view code.
 */
export interface INutanaaRuntimeConnectionService {

	readonly _serviceBrand: undefined;

	/**
	 * Current connection state.
	 */
	readonly state: NutanaaRuntimeConnectionState;

	/**
	 * Fires whenever {@link state} changes.
	 */
	readonly onDidChangeState: Event<NutanaaRuntimeConnectionState>;

	/**
	 * Fires whenever the set of running agents changes while connected.
	 */
	readonly onDidChangeAgents: Event<void>;

	/**
	 * Attempts to (re)connect to the Nutanaa Runtime backend.
	 */
	connect(): Promise<void>;

	/**
	 * Returns the agents currently known to the runtime, or an empty array
	 * when {@link state} is not {@link NutanaaRuntimeConnectionState.Connected}.
	 */
	getAgents(): Promise<readonly INutanaaAgentSummary[]>;

	/**
	 * Returns the providers currently registered with the runtime, or an
	 * empty array when {@link state} is not
	 * {@link NutanaaRuntimeConnectionState.Connected}.
	 */
	getProviders(): Promise<readonly INutanaaProviderSummary[]>;

	/**
	 * Execute an agent through the runtime backend.
	 */
	executeAgent(name: string, payload: Record<string, unknown>): Promise<{
		success: boolean;
		output?: unknown;
		error?: string;
	}>;
}