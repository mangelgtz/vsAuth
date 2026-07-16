export interface GoogleProfile {
  readonly googleId: string;
  readonly email: string;
  readonly name: string;
}

/**
 * Outbound port for Google OAuth2. Hides the actual library
 * (google-auth-library) from the application layer.
 */
export interface IGoogleAuthPort {
  /** Build the Google consent URL (used by the WebView/web flow). */
  getAuthorizationUrl(state?: string): string;
  /** Exchange an authorization `code` (web/WebView flow) for the user profile. */
  exchangeCodeForProfile(code: string): Promise<GoogleProfile>;
  /**
   * Verify a Google `id_token` obtained natively on the device
   * (e.g. via the `google_sign_in` Flutter plugin) and return the profile.
   */
  verifyIdToken(idToken: string): Promise<GoogleProfile>;
}
