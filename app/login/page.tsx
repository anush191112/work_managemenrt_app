import { LoginForm } from "./login-form";
import { BrandLogo } from "../brand-logo";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <header className="login-brand">
          <BrandLogo />
          <p className="eyebrow">Stoneking team workspace</p>
          <h1 id="login-title">Outreach Desk</h1>
          <p className="login-intro">Enter your credentials to continue.</p>
        </header>
        <LoginForm />
      </section>
    </main>
  );
}
