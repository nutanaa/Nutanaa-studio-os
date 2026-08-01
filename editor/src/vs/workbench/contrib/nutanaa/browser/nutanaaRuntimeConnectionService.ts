/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import {
	INutanaaAgentSummary,
	INutanaaRuntimeConnectionService,
	NutanaaRuntimeConnectionState,
	NUTANAA_RUNTIME_HTTP_URL,
	NUTANAA_RUNTIME_WS_URL,
} from '../common/nutanaa.js';

/** Time to wait for /health to respond before treating the runtime as unreachable. */
const HEALTH_CHECK_TIMEOUT_MS = 3000;

interface INutanaaHealthResponse {
	readonly status: string;
	readonly version: string;
	readonly uptimeSeconds: number;
}

/**
 * Default {@link INutanaaRuntimeConnectionService}.
 *
 * Phase 1: talks to the real Nutanaa Runtime backend (`runtime/main.py`) —
 * an HTTP health check followed by a WebSocket held open to detect
 * disconnects. It still reports no agents, since the Agent Engine isn't
 * wired to the runtime process yet (Phase 2); {@link getAgents} stays
 * honest about that rather than synthesizing data. Auto-reconnect is not
 * implemented here either — a dropped connection moves to
 * {@link NutanaaRuntimeConnectionState.Error} and stays there until
 * something calls {@link connect} again.
 */
export class NutanaaRuntimeConnectionService extends Disposable implements INutanaaRuntimeConnectionService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeState = this._register(new Emitter<NutanaaRuntimeConnectionState>());
	readonly onDidChangeState: Event<NutanaaRuntimeConnectionState> = this._onDidChangeState.event;

	private readonly _onDidChangeAgents = this._register(new Emitter<void>());
	readonly onDidChangeAgents: Event<void> = this._onDidChangeAgents.event;

	private _state: NutanaaRuntimeConnectionState = NutanaaRuntimeConnectionState.Disconnected;
	get state(): NutanaaRuntimeConnectionState {
		return this._state;
	}

	private _agents: readonly INutanaaAgentSummary[] = [];
	private socket: WebSocket | undefined;

	constructor(
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	async connect(): Promise<void> {
		this.setState(NutanaaRuntimeConnectionState.Connecting);

		const healthy = await this.checkHealth();
		if (!healthy) {
			this.setState(NutanaaRuntimeConnectionState.Error);
			return;
		}

		try {
			await this.openSocket();
			this.setState(NutanaaRuntimeConnectionState.Connected);
		} catch (err) {
			this.logService.warn('[Nutanaa] failed to open runtime event socket.', err);
			this.setState(NutanaaRuntimeConnectionState.Error);
		}
	}

	async getAgents(): Promise<readonly INutanaaAgentSummary[]> {
		if (this._state !== NutanaaRuntimeConnectionState.Connected) {
			return [];
		}
		// The runtime process doesn't report agents yet (Agent Engine is
		// still unwired — Phase 2). Returns whatever was last pushed over
		// the socket, which today is always empty.
		return this._agents;
	}

	private async checkHealth(): Promise<boolean> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
		try {
			const response = await fetch(`${NUTANAA_RUNTIME_HTTP_URL}/health`, { signal: controller.signal });
			if (!response.ok) {
				this.logService.warn(`[Nutanaa] runtime health check returned HTTP ${response.status}.`);
				return false;
			}
			const body = await response.json() as INutanaaHealthResponse;
			if (body.status !== 'ok') {
				this.logService.warn(`[Nutanaa] runtime health check reported non-ok status: ${body.status}.`);
				return false;
			}
			return true;
		} catch (err) {
			// Most common case: the runtime process isn't running at all.
			this.logService.warn('[Nutanaa] runtime health check failed — is `runtime/main.py` running?', err);
			return false;
		} finally {
			clearTimeout(timeout);
		}
	}

	private openSocket(): Promise<void> {
		this.socket?.close();

		return new Promise<void>((resolve, reject) => {
			const socket = new WebSocket(NUTANAA_RUNTIME_WS_URL);
			this.socket = socket;

			socket.addEventListener('open', () => resolve());

			socket.addEventListener('message', (event) => {
				this.handleMessage(event.data);
			});

			socket.addEventListener('error', (event) => {
				reject(event);
			});

			socket.addEventListener('close', () => {
				if (this.socket === socket) {
					this.socket = undefined;
					// Only report the drop if we'd previously made it to Connected;
					// if we're still inside openSocket's own connect attempt, the
					// 'error' listener above already handles rejection.
					if (this._state === NutanaaRuntimeConnectionState.Connected) {
						this.logService.warn('[Nutanaa] runtime event socket closed unexpectedly.');
						this.setState(NutanaaRuntimeConnectionState.Error);
					}
				}
			});
		});
	}

	private handleMessage(data: unknown): void {
		if (typeof data !== 'string') {
			return;
		}
		let message: { type?: string };
		try {
			message = JSON.parse(data);
		} catch {
			return;
		}
		// Phase 1 only defines a heartbeat message; agent/workflow/provider
		// event types get added here once the Agent Engine is wired in.
		if (message.type !== 'heartbeat') {
			this.logService.trace(`[Nutanaa] unhandled runtime event type: ${message.type}`);
		}
	}

	private setState(state: NutanaaRuntimeConnectionState): void {
		if (this._state === state) {
			return;
		}
		this._state = state;
		this._onDidChangeState.fire(state);
	}

	override dispose(): void {
		this.socket?.close();
		this.socket = undefined;
		super.dispose();
	}
}
