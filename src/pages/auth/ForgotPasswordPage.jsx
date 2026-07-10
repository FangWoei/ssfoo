// src/pages/auth/ForgotPasswordPage.jsx
import { resetPassword } from "@/firebase/auth";
import { useState } from "react";
import toast from "react-hot-toast";
import { FiArrowLeft, FiCheckCircle, FiMail } from "react-icons/fi";
import { Link } from "react-router-dom";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch {
      toast.error(
        "Could not send reset email. Check the address and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-50 dark:bg-dark-950 px-4">
      <div className="w-full max-w-md card p-8 dark:bg-dark-900 dark:border-dark-800">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm text-dark-500 dark:text-dark-400 hover:text-dark-800 dark:hover:text-dark-200 mb-6 transition-colors">
          <FiArrowLeft size={14} /> Back to login
        </Link>

        {sent ? (
          <div className="text-center py-4">
            <FiCheckCircle size={48} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-display font-bold text-dark-900 dark:text-dark-100 mb-2">
              Email sent!
            </h2>
            <p className="text-dark-500 dark:text-dark-400 text-sm">
              Check <strong>{email}</strong> for a password reset link.
            </p>
            <Link to="/login" className="btn-primary inline-flex mt-6">
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-display font-bold text-dark-900 dark:text-dark-100 mb-2">
              Forgot password?
            </h1>
            <p className="text-dark-500 dark:text-dark-400 text-sm mb-6">
              Enter your email and we'll send you a reset link.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <FiMail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400"
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input pl-10 dark:bg-dark-800 dark:border-dark-700 dark:text-dark-100 dark:placeholder-dark-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full">
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
