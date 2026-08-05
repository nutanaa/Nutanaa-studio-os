/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Nutanaa Studio OS. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import {
	AuthProviderType,
	IAuthProvider,
	IUserCredentials,
	IAuthToken,
	IUserSession,
	IUser,
} from '../models/enterpriseModel.js';

/**
 * Service for managing authentication in Nutanaa Studio OS Enterprise.
 *
 * Responsibilities:
 * - Local login with password policies
 * - OAuth2, OIDC, SAML provider support
 * - API key authentication
 * - Token refresh and session management
 * - Logout and session termination
 * - Password policy enforcement
 */
export const IAuthenticationManager = createDecorator<IAuthenticationManager>('nutanaaAuthenticationManager');

export interface IAuthenticationManager {

	// ── Provider Management ───────────────────────────────────────────────────

	/**
	 * Register an authentication provider.
	 * @param provider The provider configuration
	 */
	registerProvider(provider: IAuthProvider): void;

	/**
	 * Unregister an authentication provider.
	 * @param providerId The provider ID
	 */
	unregisterProvider(providerId: string): void;

	/**
	 * Get all registered providers.
	 * @returns Array of providers
	 */
	getProviders(): IAuthProvider[];

	/**
	 * Get provider by ID.
	 * @param providerId The provider ID
	 * @returns Provider or undefined
	 */
	getProvider(providerId: string): IAuthProvider | undefined;

	/**
	 * Get provider by type.
	 * @param type The provider type
	 * @returns Provider or undefined
	 */
	getProviderByType(type: AuthProviderType): IAuthProvider | undefined;

	// ── Authentication ───────────────────────────────────────────────────────

	/**
	 * Authenticate with credentials.
	 * @param credentials The user credentials
	 * @returns Auth token or undefined
	 */
	authenticate(credentials: IUserCredentials): Promise<IAuthToken | undefined>;

	/**
	 * Authenticate with OAuth2/OIDC.
	 * @param providerId The provider ID
	 * @param code The authorization code
	 * @returns Auth token or undefined
	 */
	authenticateWithCode(providerId: string, code: string): Promise<IAuthToken | undefined>;

	/**
	 * Authenticate with API key.
	 * @param apiKey The API key
	 * @returns Auth token or undefined
	 */
	authenticateWithApiKey(apiKey: string): Promise<IAuthToken | undefined>;

	/**
	 * Refresh an authentication token.
	 * @param refreshToken The refresh token
	 * @returns New auth token or undefined
	 */
	refreshToken(refreshToken: string): Promise<IAuthToken | undefined>;

	/**
	 * Verify a token is valid.
	 * @param token The token to verify
	 * @returns True if valid
	 */
	verifyToken(token: string): Promise<boolean>;

	// ── Session Management ───────────────────────────────────────────────────

	/**
	 * Get current session.
	 * @returns Current session or undefined
	 */
	getCurrentSession(): IUserSession | undefined;

	/**
	 * Get all sessions for a user.
	 * @param userId The user ID
	 * @returns Array of sessions
	 */
	getUserSessions(userId: string): IUserSession[];

	/**
	 * Revoke a session.
	 * @param sessionId The session ID
	 */
	revokeSession(sessionId: string): Promise<void>;

	/**
	 * Revoke all sessions for a user.
	 * @param userId The user ID
	 */
	revokeAllSessions(userId: string): Promise<void>;

	// ── User Management ───────────────────────────────────────────────────────

	/**
	 * Get current user.
	 * @returns Current user or undefined
	 */
	getCurrentUser(): IUser | undefined;

	/**
	 * Get user by ID.
	 * @param userId The user ID
	 * @returns User or undefined
	 */
	getUser(userId: string): IUser | undefined;

	/**
	 * Get all users.
	 * @returns Array of users
	 */
	getAllUsers(): IUser[];

	/**
	 * Create a new user.
	 * @param user The user to create
	 * @param password Optional password for local auth
	 * @returns Created user
	 */
	createUser(user: Omit<IUser, 'id' | 'createdAt'>, password?: string): Promise<IUser>;

	/**
	 * Update user profile.
	 * @param userId The user ID
	 * @param updates The updates
	 */
	updateUser(userId: string, updates: Partial<IUser>): Promise<void>;

	/**
	 * Change user password.
	 * @param userId The user ID
	 * @param oldPassword The old password
	 * @param newPassword The new password
	 */
	changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;

	// ── Logout ───────────────────────────────────────────────────────────────

	/**
	 * Logout current user.
	 */
	logout(): Promise<void>;

	/**
	 * Logout from a specific provider.
	 * @param providerId The provider ID
	 */
	logoutFromProvider(providerId: string): Promise<void>;

	// ── Events ─────────────────────────────────────────────────────────────────

	/**
	 * Event fired when user logs in.
	 */
	onDidLogin: (listener: (user: IUser, providerId: string) => void) => { dispose(): void };

	/**
	 * Event fired when user logs out.
	 */
	onDidLogout: (listener: (userId: string, reason: string) => void) => { dispose(): void };

	/**
	 * Event fired when session expires.
	 */
	onDidSessionExpire: (listener: (sessionId: string) => void) => { dispose(): void };
}