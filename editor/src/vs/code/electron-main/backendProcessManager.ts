/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { closeSync, existsSync, mkdirSync, openSync, writeFileSync } from 'fs';
import { request } from 'http';
import { dirname, join, normalize } from '../../../base/common/path.js';
import { Event } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { IEnvironmentMainService } from '../../platform/environment/electron-main/environmentMainService.js';
import { ILogService } from '../../platform/log/common/log.js';
import { ILifecycleMainService } from '../../platform/lifecycle/electron-main/lifecycleMainService.js';

const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = 8787;
const BACKEND_HEALTH_PATH = '/health';
const BACKEND_START_TIMEOUT_MS = 20_000;
const BACKEND_POLL_INTERVAL_MS = 500;

export class BackendProcessManager extends Disposable {
	private backendProcess: ChildProcessWithoutNullStreams | undefined;
	private backendStdoutFd: number | undefined;
	private backendStderrFd: number | undefined;

	constructor(
		private readonly environmentMainService: IEnvironmentMainService,
		private readonly logService: ILogService,
		lifecycleMainService: ILifecycleMainService
	) {
		super();

		Event.once(lifecycleMainService.onWillShutdown)(() => this.dispose());
	}

	public async startBackendIfAvailable(): Promise<void> {
		if (this.environmentMainService.isBuilt) {
			this.logService.debug('Skipping backend startup in built environment.');
			return;
		}

		if (this.environmentMainService.args['skip-backend']) {
			this.logService.debug('Skipping backend startup because --skip-backend was passed.');
			return;
		}

		const repoRoot = normalize(join(this.environmentMainService.appRoot, '..'));
		const entryPoint = join(repoRoot, 'backend', 'api', 'main.py');
		if (!existsSync(entryPoint)) {
			this.logService.debug(`Backend entrypoint not found: ${entryPoint}`);
			return;
		}

		if (await this.isBackendAlreadyRunning()) {
			this.logService.info('Backend already running; skipping automatic startup.');
			return;
		}

		const pythonPath = this.findPythonExecutable(repoRoot);
		if (!pythonPath) {
			this.logService.warn('No Python executable found to start the backend. Expected a local venv at <repo>/venv or <repo>/editor/venv.');
			return;
		}

		const logDir = join(repoRoot, 'logs');
		mkdirSync(logDir, { recursive: true });

		const stdoutPath = join(logDir, 'backend.log');
		const stderrPath = join(logDir, 'backend.err');
		const metadataPath = join(logDir, 'backend.meta.log');

		this.backendStdoutFd = openSync(stdoutPath, 'a');
		this.backendStderrFd = openSync(stderrPath, 'a');

		const env = {
			...process.env,
			PYTHONPATH: repoRoot,
			PYTHONUNBUFFERED: '1'
		};

		const args = [
			'-m',
			'uvicorn',
			'backend.api.main:app',
			'--host',
			BACKEND_HOST,
			'--port',
			`${BACKEND_PORT}`,
			'--reload'
		];

		this.logService.info(`Starting backend process: ${pythonPath} ${args.join(' ')}`);
		this.backendProcess = spawn(pythonPath, args, {
			cwd: repoRoot,
			env,
			stdio: ['ignore', this.backendStdoutFd, this.backendStderrFd],
			windowsHide: true
		});

		this.backendProcess.on('error', error => {
			this.logService.error(`Backend process failed to start: ${error.message}`);
		});

		this.backendProcess.on('exit', (code, signal) => {
			this.logService.info(`Backend process exited (code: ${code ?? 'unknown'}, signal: ${signal ?? 'none'}).`);
		});

		this.writeBackendMetadata(metadataPath, pythonPath, args, repoRoot);

		await this.waitForBackendStartup();
	}

	private writeBackendMetadata(metadataPath: string, pythonPath: string, args: readonly string[], repoRoot: string): void {
		try {
			const metadata = [
				`startedAt=${new Date().toISOString()}`,
				`repoRoot=${repoRoot}`,
				`python=${pythonPath}`,
				`args=${args.join(' ')}`,
				`pid=${this.backendProcess?.pid ?? 'unknown'}`
			].join('\n') + '\n';

			writeFileSync(metadataPath, metadata, { encoding: 'utf8' });
		} catch (error) {
			this.logService.warn('Unable to write backend metadata.', error);
		}
	}

	private findPythonExecutable(repoRoot: string): string | undefined {
		const candidates = [
			join(repoRoot, 'venv', 'Scripts', 'python.exe'),
			join(repoRoot, 'editor', 'venv', 'Scripts', 'python.exe'),
			join(repoRoot, 'venv', 'bin', 'python3'),
			join(repoRoot, 'editor', 'venv', 'bin', 'python3')
		];

		return candidates.find(candidate => existsSync(candidate));
	}

	private async isBackendAlreadyRunning(): Promise<boolean> {
		try {
			return await this.tryHealthRequest();
		} catch {
			return false;
		}
	}

	private async waitForBackendStartup(): Promise<void> {
		const deadline = Date.now() + BACKEND_START_TIMEOUT_MS;

		while (Date.now() < deadline) {
			if (!this.backendProcess || this.backendProcess.killed) {
				throw new Error('Backend process terminated before startup completed.');
			}

			if (await this.tryHealthRequest()) {
				this.logService.info('Backend startup completed successfully.');
				return;
			}

			await this.delay(BACKEND_POLL_INTERVAL_MS);
		}

		throw new Error('Backend did not become ready within the expected timeout.');
	}

	private tryHealthRequest(): Promise<boolean> {
		return new Promise<boolean>(resolve => {
			const req = request({
				host: BACKEND_HOST,
				port: BACKEND_PORT,
				path: BACKEND_HEALTH_PATH,
				method: 'GET',
				timeout: 2000
			}, res => {
				res.resume();
				resolve(res.statusCode === 200);
			});

			req.on('error', () => resolve(false));
			req.on('timeout', () => {
				req.destroy();
				resolve(false);
			});
			req.end();
		});
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	public dispose(): void {
		if (this.backendProcess && !this.backendProcess.killed) {
			try {
				this.backendProcess.kill();
				this.logService.info('Shutting down backend process.');
			} catch (error) {
				this.logService.warn('Failed to kill backend process on shutdown.', error);
			}
		}

		if (typeof this.backendStdoutFd === 'number') {
			closeSync(this.backendStdoutFd);
		}

		if (typeof this.backendStderrFd === 'number') {
			closeSync(this.backendStderrFd);
		}

		super.dispose();
	}
}
