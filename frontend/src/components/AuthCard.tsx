import React, { useState } from "react";
import { authService, UserSession } from "../services/auth";

interface AuthCardProps {
  onAuthenticated: (session: UserSession) => void;
}

type AuthMode = "signin" | "signup" | "confirm";

export const AuthCard: React.FC<AuthCardProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      const session = await authService.signIn(email.trim(), password);
      onAuthenticated(session);
    } catch (err: any) {
      console.error(err);
      if (err.name === "UserNotConfirmedException") {
        setError("Your account is not verified yet. Please enter the verification code.");
        setMode("confirm");
      } else {
        setError(err.message || "Failed to sign in. Please check your email and password.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      await authService.signUp(email.trim(), password, name.trim());
      setInfoMessage(`Verification code sent to ${email.trim()}. Check your inbox.`);
      setMode("confirm");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create account. Password requires 8+ characters.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      await authService.confirmSignUp(email.trim(), code.trim());
      // If password is still in state, attempt instant sign-in for seamless UX
      if (password) {
        try {
          const session = await authService.signIn(email.trim(), password);
          onAuthenticated(session);
          return;
        } catch {
          // Fall through to manual sign in if auto sign-in fails
        }
      }
      setInfoMessage("Email verified successfully! You can now sign in.");
      setMode("signin");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Invalid verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) {
      setError("Please enter your email to resend code.");
      return;
    }
    setError(null);
    try {
      await authService.resendCode(email.trim());
      setInfoMessage("A new verification code has been sent to your email.");
    } catch (err: any) {
      setError(err.message || "Failed to resend verification code.");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {mode !== "confirm" ? (
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${mode === "signin" ? "active" : ""}`}
              onClick={() => {
                setMode("signin");
                setError(null);
                setInfoMessage(null);
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab ${mode === "signup" ? "active" : ""}`}
              onClick={() => {
                setMode("signup");
                setError(null);
                setInfoMessage(null);
              }}
            >
              Create Account
            </button>
          </div>
        ) : (
          <div className="auth-header">
            <h3>Verify Your Email</h3>
            <p className="auth-subtitle">Enter the 6-digit confirmation code sent to {email}</p>
          </div>
        )}

        {error && <div className="auth-alert error">{error}</div>}
        {infoMessage && <div className="auth-alert success">{infoMessage}</div>}

        {mode === "signin" && (
          <form onSubmit={handleSignIn} className="auth-form" noValidate>
            <div className="field-group">
              <label htmlFor="signin-email">Email Address</label>
              <input
                id="signin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="field-group">
              <label htmlFor="signin-password">Password</label>
              <input
                id="signin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="btn-primary btn-block" disabled={loading}>
              {loading ? "Signing In…" : "Sign In"}
            </button>

            <div className="auth-footer-link">
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setMode("confirm");
                  setError(null);
                }}
              >
                Need to enter verification code?
              </button>
            </div>
          </form>
        )}

        {mode === "signup" && (
          <form onSubmit={handleSignUp} className="auth-form" noValidate>
            <div className="field-group">
              <label htmlFor="signup-name">Full Name</label>
              <input
                id="signup-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                autoComplete="name"
              />
            </div>

            <div className="field-group">
              <label htmlFor="signup-email">Email Address</label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="field-group">
              <label htmlFor="signup-password">Password (min 8 characters)</label>
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className="btn-primary btn-block" disabled={loading}>
              {loading ? "Creating Account…" : "Create Account"}
            </button>
          </form>
        )}

        {mode === "confirm" && (
          <form onSubmit={handleConfirm} className="auth-form" noValidate>
            <div className="field-group">
              <label htmlFor="confirm-email">Email Address</label>
              <input
                id="confirm-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="field-group">
              <label htmlFor="confirm-code">Confirmation Code</label>
              <input
                id="confirm-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                required
                maxLength={10}
              />
            </div>

            <button type="submit" className="btn-primary btn-block" disabled={loading}>
              {loading ? "Verifying…" : "Confirm Code & Sign In"}
            </button>

            <div className="auth-helpers">
              <button type="button" className="link-button" onClick={handleResendCode}>
                Resend Code
              </button>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setInfoMessage(null);
                }}
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
