import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
      <p className="eyebrow">Team workspace</p>
      <h1 id="login-title">Work Management</h1>
      <LoginForm />
      </section>
    </main>
  );
}
