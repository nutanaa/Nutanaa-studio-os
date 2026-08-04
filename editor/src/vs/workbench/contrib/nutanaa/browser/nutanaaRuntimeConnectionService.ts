/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import {
	INutanaaAgentSummary,
	INutanaaProviderSummary,
	INutanaaRuntimeConnectionService,
	NutanaaRuntimeConnectionState,
	NUTANAA_RUNTIME_HTTP_URL,
	NUTANAA_RUNTIME_WS_URL,
} from '../common/nutanaa.js';

/** Time to wait for /health to respond before treating the runtime as unreachable. */
const HEALTH_CHECK_TIMEOUT_MS = 3000;

/** Starting delay before the first automatic reconnect attempt. */
const INITIAL_RETRY_DELAY_MS = 2000;

/** Ceiling for the exponential backoff between reconnect attempts. */
const MAX_RETRY_DELAY_MS = 30000;

interface INutanaaHealthResponse {
	readonly status: string;
	readonly version: string;
	readonly uptimeSeconds: number;
}

/**
 * Default {@link INutanaaRuntimeConnectionService}.
 *
 * Talks to the real Nutanaa Runtime backend (`backend/api/main.py`) — an
 * HTTP health check followed by a WebSocket held open to detect
 * disconnects, plus on-demand HTTP fetches for agents and providers.
 * {@link getAgents} and {@link getProviders} both return an empty array
 * rather than fabricated data whenever {@link state} isn't
 * {@link NutanaaRuntimeConnectionState.Connected}, or if the fetch
 * itself fails.
 *
 * {@link connect} retries automatically with exponential backoff
 * (2s → 4s → 8s → … capped at 30s) whenever a connection attempt fails
 * or an established connection drops — this handles the common case of
 * the editor launching slightly before the backend process is ready,
 * without needing a manual "reconnect" command. Calling {@link connect}
 * explicitly (e.g. at startup) always resets the backoff and tries
 * immediately.
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

	private socket: WebSocket | undefined;
	private retryTimer: ReturnType<typeof setTimeout> | undefined;
	private retryDelayMs = INITIAL_RETRY_DELAY_MS;

	constructor(
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	async connect(): Promise<void> {
		// An explicit connect() call (e.g. at startup) always resets the
		// backoff and tries immediately, even if a retry was pending.
		this.clearRetryTimer();
		this.retryDelayMs = INITIAL_RETRY_DELAY_MS;
		await this.attemptConnect();
	}

	private async attemptConnect(): Promise<void> {
		this.setState(NutanaaRuntimeConnectionState.Connecting);

		const healthy = await this.checkHealth();
		if (!healthy) {
			this.setState(NutanaaRuntimeConnectionState.Error);
			this.scheduleRetry();
			return;
		}

		try {
			await this.openSocket();
			this.setState(NutanaaRuntimeConnectionState.Connected);
			this.retryDelayMs = INITIAL_RETRY_DELAY_MS;
		} catch (err) {
			this.logService.warn('[Nutanaa] failed to open runtime event socket.', err);
			this.setState(NutanaaRuntimeConnectionState.Error);
			this.scheduleRetry();
		}
	}

	private scheduleRetry(): void {
		this.clearRetryTimer();
		const delaySeconds = Math.round(this.retryDelayMs / 1000);
		this.logService.info(`[Nutanaa] retrying connection to runtime backend in ${delaySeconds}s…`);
		this.retryTimer = setTimeout(() => {
			this.retryTimer = undefined;
			this.attemptConnect();
		}, this.retryDelayMs);
		this.retryDelayMs = Math.min(this.retryDelayMs * 2, MAX_RETRY_DELAY_MS);
	}

	private clearRetryTimer(): void {
		if (this.retryTimer !== undefined) {
			clearTimeout(this.retryTimer);
			this.retryTimer = undefined;
		}
	}

	async getAgents(): Promise<readonly INutanaaAgentSummary[]> {
		if (this._state !== NutanaaRuntimeConnectionState.Connected) {
			return [];
		}
		try {
			const response = await fetch(`${NUTANAA_RUNTIME_HTTP_URL}/agents`);
			if (!response.ok) {
				this.logService.warn(`[Nutanaa] /agents returned HTTP ${response.status}.`);
				return [];
			}
			return await response.json() as INutanaaAgentSummary[];
		} catch (err) {
			this.logService.warn('[Nutanaa] failed to fetch agents.', err);
			return [];
		}
	}

	async getProviders(): Promise<readonly INutanaaProviderSummary[]> {
		if (this._state !== NutanaaRuntimeConnectionState.Connected) {
			return [];
		}
		try {
			const response = await fetch(`${NUTANAA_RUNTIME_HTTP_URL}/providers`);
			if (!response.ok) {
				this.logService.warn(`[Nutanaa] /providers returned HTTP ${response.status}.`);
				return [];
			}
			return await response.json() as INutanaaProviderSummary[];
		} catch (err) {
			this.logService.warn('[Nutanaa] failed to fetch providers.', err);
			return [];
		}
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
						this.scheduleRetry();
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
		this.clearRetryTimer();
		this.socket?.close();
		this.socket = undefined;
		super.dispose();
	}
}