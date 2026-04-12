/**
 * Login page — shared password authentication.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { login } from "../lib/api";
import LanguageSwitcher from "../components/LanguageSwitcher";
import Logo from "../components/Logo";

interface Props {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: Props) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(password);
      onLogin();
    } catch {
      setError(t("login.invalidPassword"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-stone-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm"
      >
        <div className="flex justify-end mb-2">
          <LanguageSwitcher />
        </div>
        <div className="flex justify-center mb-4">
          <Logo size={48} />
        </div>
        <h1 className="text-2xl font-bold text-stone-800 mb-6 text-center">
          {t("login.title")}
        </h1>
        <p className="text-sm text-stone-500 mb-4 text-center">
          {t("login.subtitle")}
        </p>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded mb-4">
            {error}
          </div>
        )}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("login.password")}
          className="w-full px-4 py-3 border border-stone-300 rounded-lg mb-4 outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          autoFocus
        />
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full py-3 bg-amber-700 text-white rounded-lg font-semibold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? t("login.signingIn") : t("login.signIn")}
        </button>
      </form>
    </div>
  );
}
