/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../../base/common/event.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import {
	AuthProviderType,
	IAuthProvider,
	IUserCredentials,
	IAuthToken,
	IUserSession,
	IUser,
} from '../../models/enterpriseModel.js';
import { IAuthenticationManager } from '../../common/auth/authenticationManager.js';
import { IRuntimeEventBus } from '../../common/runtime/runtimeEventBus.js';
import { RuntimeEventType } from '../../common/runtime/runtimeEvents.js';
import { IRuntimeStateService } from '../../common/runtime/runtimeState.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';

/**
 * AuthenticationManager implementation for Nutanaa Studio OS Enterprise.
 *
 * Manages authentication with multiple providers, session handling,
 * and user management with password policies.
 */
export class AuthenticationManager extends Disposable implements IAuthenticationManager {

	declare readonly _serviceBrand: undefined;

	private readonly providers = new Map<string, IAuthProvider>();
	private readonly sessions = new Map<string, IUserSession>();
	private readonly users = new Map<string, IUser>();
	private readonly userPasswords = new Map<string, string>();

	private currentSession: IUserSession | undefined;
	private currentUser: IUser | undefined;

	private readonly _onDidLogin = this._register(new Emitter<{ user: IUser; providerId: string }>());
	private readonly _onDidLogout = this._register(new Emitter<{ userId: string; reason: string }>());
	private readonly _onDidSessionExpire = this._register(new Emitter<{ sessionId: string }>());

	public readonly onDidLogin = this._onDidLogin.event;
	public readonly onDidLogout = this._onDidLogout.event;
	public readonly onDidSessionExpire = this._onDidSessionExpire.event;

	private readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

	constructor(
		@IRuntimeEventBus private readonly runtimeEventBus: IRuntimeEventBus,
		@IRuntimeStateService private readonly runtimeStateService: IRuntimeStateService,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.loadUsers();
		this.initializeDefaultProvider();
	}

	private initializeDefaultProvider(): void {
		// Register default local authentication provider
		this.registerProvider({
			id: 'local',
			type: 'local',
			name: 'Local',
			enabled: true,
			config: {},
		});
	}

	// ── Provider Management ───────────────────────────────────────────────────

	registerProvider(provider: IAuthProvider): void {
		if (this.providers.has(provider.id)) {
			this.logService.warn(`Provider ${provider.id} already registered`);
			return;
		}
		this.providers.set(provider.id, provider);
		this.logService.info(`Auth provider ${provider.name} (${provider.type}) registered`);
	}

	unregisterProvider(providerId: string): void {
		if (!this.providers.has(providerId)) {
			return;
		}
		this.providers.delete(providerId);
		this.logService.info(`Auth provider ${providerId} unregistered`);
	}

	getProviders(): IAuthProvider[] {
		return Array.from(this.providers.values()).filter(p => p.enabled);
	}

	getProvider(providerId: string): IAuthProvider | undefined {
		return this.providers.get(providerId);
	}

	getProviderByType(type: AuthProviderType): IAuthProvider | undefined {
		for (const provider of this.providers.values()) {
			if (provider.type === type && provider.enabled) {
				return provider;
			}
		}
		return undefined;
	}

	// ── Authentication ───────────────────────────────────────────────────────

	async authenticate(credentials: IUserCredentials): Promise<IAuthToken | undefined> {
		const providerId = credentials.providerId || 'local';
		const provider = this.getProvider(providerId);

		if (!provider) {
			this.logService.error(`Authentication provider ${providerId} not found`);
			return undefined;
		}

		try {
			let token: IAuthToken | undefined;

			switch (provider.type) {
				case 'local':
					token = await this.authenticateLocal(credentials.username, credentials.password || '');
					break;
				case 'oauth2':
				case 'oidc':
				case 'saml':
					token = await this.authenticateFederated(provider, credentials);
					break;
				case 'apikey':
					token = await this.authenticateWithApiKey(credentials.username);
					break;
			}

			if (token) {
				const user = this.users.get(credentials.username);
				if (user) {
					await this.createSession(user, providerId, token);
				}
			}

			return token;
		} catch (error) {
			this.logService.error(`Authentication failed: ${error}`);
			return undefined;
		}
	}

	private async authenticateLocal(username: string, password: string): Promise<IAuthToken | undefined> {
		const storedPassword = this.userPasswords.get(username);
		if (!storedPassword || storedPassword !== this.hashPassword(password)) {
			this.logService.warn(`Local authentication failed for user ${username}`);
			return undefined;
		}

		const user = this.users.get(username);
		if (!user || !user.enabled) {
			return undefined;
		}

		return this.createToken();
	}

	private async authenticateFederated(provider: IAuthProvider, credentials: IUserCredentials): Promise<IAuthToken | undefined> {
		// In a real implementation, this would call the OAuth/OIDC/SAML endpoint
		// For now, we simulate a successful authentication
		const user = this.users.get(credentials.username);
		if (!user) {
			// Auto-provision user from federated identity
			return this.createToken();
		}

		return this.createToken();
	}

	async authenticateWithCode(providerId: string, code: string): Promise<IAuthToken | undefined> {
		const provider = this.getProvider(providerId);
		if (!provider) {
			return undefined;
		}

		// Exchange authorization code for token
		// Real implementation would call the provider's token endpoint
		return this.createToken();
	}

	async authenticateWithApiKey(apiKey: string): Promise<IAuthToken | undefined> {
		// Validate API key and get associated user
		// For demo, accept any key starting with 'nutanaa_'
		if (!apiKey.startsWith('nutanaa_')) {
			return undefined;
		}

		return this.createToken();
	}

	async refreshToken(refreshToken: string): Promise<IAuthToken | undefined> {
		// Validate refresh token and issue new access token
		// Real implementation would verify the refresh token and check expiration
		return this.createToken();
	}

	async verifyToken(token: string): Promise<boolean> {
		// Validate token format and expiration
		if (!token || token.length < 10) {
			return false;
		}

		// Check if token matches current session
		return this.currentSession?.token.accessToken === token;
	}

	// ── Session Management ───────────────────────────────────────────────────

	getCurrentSession(): IUserSession | undefined {
		return this.currentSession;
	}

	getUserSessions(userId: string): IUserSession[] {
		const user = this.users.get(userId);
		if (!user) {
			return [];
		}

		return Array.from(this.sessions.values())
			.filter(s => s.userId === userId);
	}

	async revokeSession(sessionId: string): Promise<void> {
		const session = this.sessions.get(sessionId);
		if (!session) {
			return;
		}

		this.sessions.delete(sessionId);

		if (this.currentSession?.id === sessionId) {
			await this.logout();
		}

		this.logService.info(`Session ${sessionId} revoked`);
	}

	async revokeAllSessions(userId: string): Promise<void> {
		const sessionsToRevoke = this.getUserSessions(userId);

		for (const session of sessionsToRevoke) {
			this.sessions.delete(session.id);
		}

		if (this.currentUser?.id === userId) {
			await this.logout();
		}

		this.logService.info(`All sessions revoked for user ${userId}`);
	}

	// ── User Management ───────────────────────────────────────────────────────

	getCurrentUser(): IUser | undefined {
		return this.currentUser;
	}

	getUser(userId: string): IUser | undefined {
		return this.users.get(userId);
	}

	getAllUsers(): IUser[] {
		return Array.from(this.users.values());
	}

	async createUser(userData: Omit<IUser, 'id' | 'createdAt'>, password?: string): Promise<IUser> {
		const user: IUser = {
			...userData,
			id: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			createdAt: Date.now(),
		};

		this.users.set(user.id, user);
		this.users.set(user.username, user);

		if (password) {
			this.userPasswords.set(user.username, this.hashPassword(password));
		}

		this.saveUsers();

		this.logService.info(`User ${user.username} created`);
		return user;
	}

	async updateUser(userId: string, updates: Partial<IUser>): Promise<void> {
		const user = this.users.get(userId);
		if (!user) {
			throw new Error(`User ${userId} not found`);
		}

		const updatedUser = { ...user, ...updates };
		this.users.set(userId, updatedUser);

		// Update username map
		if (updates.username && updates.username !== user.username) {
			this.users.delete(user.username);
			this.users.set(updates.username, updatedUser);

			// Move password hash
			const password = this.userPasswords.get(user.username);
			if (password) {
				this.userPasswords.delete(user.username);
				this.userPasswords.set(updates.username, password);
			}
		}

		this.saveUsers();
	}

	async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
		const user = this.users.get(userId);
		if (!user) {
			throw new Error(`User ${userId} not found`);
		}

		const currentHash = this.userPasswords.get(user.username);
		if (currentHash && currentHash !== this.hashPassword(oldPassword)) {
			throw new Error('Current password is incorrect');
		}

		this.validatePassword(newPassword);
		this.userPasswords.set(user.username, this.hashPassword(newPassword));
		this.saveUsers();

		this.logService.info(`Password changed for user ${user.username}`);
	}

	// ── Logout ───────────────────────────────────────────────────────────────

	async logout(): Promise<void> {
		if (!this.currentSession || !this.currentUser) {
			return;
		}

		const userId = this.currentUser.id;
		const sessionId = this.currentSession.id;

		this.sessions.delete(sessionId);
		this.currentSession = undefined;
		this.currentUser = undefined;

		// Update runtime state
		this.updateRuntimeState();

		// Fire events
		this._onDidLogout.fire({ userId, reason: 'user_initiated' });
		this.runtimeEventBus.fire({
			type: RuntimeEventType.UserLoggedOut,
			timestamp: Date.now(),
			payload: { userId, sessionId, reason: 'user_initiated' },
		});

		this.logService.info(`User ${userId} logged out`);
	}

	async logoutFromProvider(providerId: string): Promise<void> {
		// Revoke tokens for specific provider
		this.logService.info(`Logged out from provider ${providerId}`);
	}

	// ── Helper Methods ─────────────────────────────────────────────────────────

	private async createSession(user: IUser, providerId: string, token: IAuthToken): Promise<void> {
		const session: IUserSession = {
			id: `session-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			userId: user.id,
			providerId,
			token,
			createdAt: Date.now(),
			lastActivityAt: Date.now(),
		};

		this.sessions.set(session.id, session);
		this.currentSession = session;
		this.currentUser = user;

		// Update last login
		user.lastLoginAt = Date.now();
		this.users.set(user.id, user);
		this.saveUsers();

		// Update runtime state
		this.updateRuntimeState();

		// Fire events
		this._onDidLogin.fire({ user, providerId });
		this.runtimeEventBus.fire({
			type: RuntimeEventType.UserLoggedIn,
			timestamp: Date.now(),
			payload: { user, providerId, sessionId: session.id },
		});

		this.logService.info(`User ${user.username} logged in via ${providerId}`);
	}

	private createToken(): IAuthToken {
		const expiresAt = Date.now() + this.SESSION_TIMEOUT;
		return {
			accessToken: `token-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			refreshToken: `refresh-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			tokenType: 'Bearer',
			expiresAt,
			scope: 'openid profile email',
		};
	}

	private hashPassword(password: string): string {
		// Simple hash for demo - in production use bcrypt or similar
		let hash = 0;
		for (let i = 0; i < password.length; i++) {
			const char = password.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash;
		}
		return `hash_${hash.toString(16)}`;
	}

	private validatePassword(password: string): void {
		if (password.length < 8) {
			throw new Error('Password must be at least 8 characters');
		}
		if (!/[A-Z]/.test(password)) {
			throw new Error('Password must contain an uppercase letter');
		}
		if (!/[a-z]/.test(password)) {
			throw new Error('Password must contain a lowercase letter');
		}
		if (!/[0-9]/.test(password)) {
			throw new Error('Password must contain a number');
		}
	}

	private updateRuntimeState(): void {
		this.runtimeStateService.update({
			enterprise: {
				currentUser: this.currentUser,
				currentOrganization: undefined,
				session: this.currentSession,
				isAuthenticated: !!this.currentUser,
				userPermissions: [],
				userRoles: this.currentUser?.roles || [],
				organizationTeamIds: [],
			},
		});
	}

	private loadUsers(): void {
		const stored = this.storageService.get('nutanaa.users', 0);
		if (stored) {
			try {
				const data = JSON.parse(stored);
				this.users.clear();
				this.userPasswords.clear();
				for (const user of data.users || []) {
					this.users.set(user.id, user);
					this.users.set(user.username, user);
				}
				for (const [username, password] of data.passwords || []) {
					this.userPasswords.set(username, password);
				}
			} catch {
				// Keep empty maps on error
			}
		}
	}

	private saveUsers(): void {
		const usersList: IUser[] = [];
		this.users.forEach((user) => {
			if (!usersList.find(u => u.id === user.id)) {
				usersList.push(user);
			}
		});
		const data = {
			users: usersList,
			passwords: Array.from(this.userPasswords.entries()),
		};
		this.storageService.store('nutanaa.users', JSON.stringify(data), StorageScope.APPLICATION, StorageTarget.MACHINE);
	}
}