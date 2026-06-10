import { useState } from "react";

type Props = {
  onSubmit: (name: string, email: string) => Promise<void>;
};

export function EmailCaptureForm({ onSubmit }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(name, email);
    } catch {
      setError("We could not submit your request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="handoff-form" onSubmit={handleSubmit}>
      <label className="borrower-field">
        Name
        <input
          autoComplete="name"
          required
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="borrower-field">
        Email
        <input
          autoComplete="email"
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      {error ? <p className="borrower-form-error">{error}</p> : null}
      <button className="borrower-primary-btn" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Submitting..." : "Connect me with a specialist"}
      </button>
    </form>
  );
}
