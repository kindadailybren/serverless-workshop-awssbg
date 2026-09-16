import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  InitiateAuthCommand,
  AuthFlowType,
} from "@aws-sdk/client-cognito-identity-provider";

export interface UserSession {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Unix timestamp in ms
  email: string;
  name?: string;
  sub: string;
}

const REGION = (import.meta.env.VITE_AWS_REGION as string) || "us-east-1";
const CLIENT_ID = (import.meta.env.VITE_COGNITO_CLIENT_ID as string) || "";

const client = new CognitoIdentityProviderClient({ region: REGION });
const STORAGE_KEY = "workshop_user_session";

function parseJwt(token: string): Record<string, any> {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("Failed to parse JWT", e);
    return {};
  }
}

export const authService = {
  /**
   * Register a new user with Cognito
   */
  async signUp(email: string, password: string, name?: string): Promise<{ userSub: string; isConfirmed: boolean }> {
    if (!CLIENT_ID) {
      throw new Error("Missing VITE_COGNITO_CLIENT_ID in environment variables");
    }

    const command = new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: "email", Value: email },
        ...(name ? [{ Name: "name", Value: name }] : []),
      ],
    });

    const response = await client.send(command);
    return {
      userSub: response.UserSub || "",
      isConfirmed: !!response.UserConfirmed,
    };
  },

  /**
   * Confirm sign up using the verification code sent to email
   */
  async confirmSignUp(email: string, code: string): Promise<boolean> {
    if (!CLIENT_ID) {
      throw new Error("Missing VITE_COGNITO_CLIENT_ID in environment variables");
    }

    const command = new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code.trim(),
    });

    await client.send(command);
    return true;
  },

  /**
   * Resend confirmation code
   */
  async resendCode(email: string): Promise<void> {
    if (!CLIENT_ID) {
      throw new Error("Missing VITE_COGNITO_CLIENT_ID in environment variables");
    }

    const command = new ResendConfirmationCodeCommand({
      ClientId: CLIENT_ID,
      Username: email,
    });

    await client.send(command);
  },

  /**
   * Sign in user with email & password (USER_PASSWORD_AUTH)
   */
  async signIn(email: string, password: string): Promise<UserSession> {
    if (!CLIENT_ID) {
      throw new Error("Missing VITE_COGNITO_CLIENT_ID in environment variables");
    }

    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    });

    const response = await client.send(command);
    const authResult = response.AuthenticationResult;

    if (!authResult || !authResult.IdToken || !authResult.AccessToken) {
      throw new Error("Authentication failed: No tokens received");
    }

    const payload = parseJwt(authResult.IdToken);
    const expiresIn = authResult.ExpiresIn || 3600;

    const session: UserSession = {
      idToken: authResult.IdToken,
      accessToken: authResult.AccessToken,
      refreshToken: authResult.RefreshToken,
      expiresAt: Date.now() + expiresIn * 1000,
      email: payload.email || email,
      name: payload.name || payload["cognito:username"] || email.split("@")[0],
      sub: payload.sub,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return session;
  },

  /**
   * Get currently active session from storage
   */
  getSession(): UserSession | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
      const session: UserSession = JSON.parse(raw);
      // Check token expiration with 60s buffer
      if (Date.now() > session.expiresAt - 60000) {
        this.signOut();
        return null;
      }
      return session;
    } catch {
      this.signOut();
      return null;
    }
  },

  /**
   * Get valid raw ID Token to send in Authorization header
   */
  getIdToken(): string | null {
    const session = this.getSession();
    return session ? session.idToken : null;
  },

  /**
   * Sign out and clear stored session
   */
  signOut(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};
