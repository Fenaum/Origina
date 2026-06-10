"use client";
import { useState } from "react";
import { useInView } from "@/hooks/useInView";

const audiences = ["For Borrowers", "For Brokers"] as const;
type Audience = (typeof audiences)[number];

const steps: Record<Audience, { heading: string; description: string }[]> = {
  "For Borrowers": [
    {
      heading: "Tell us about your goals",
      description:
        "Share some basic details about your homeownership intentions, income type, and the property you're interested in. No SSN or credit pull at this stage.",
    },
    {
      heading: "Explore potential options",
      description:
        "See which Non-QM loan programs may fit your situation. Review estimated payments, down payment requirements, and documentation guidance — all in plain language.",
    },
    {
      heading: "Connect with an expert",
      description:
        "When you're ready, get matched with a licensed mortgage professional who specializes in your loan type. They guide you from here.",
    },
  ],
  "For Brokers": [
    {
      heading: "Create your partner account",
      description:
        "Quick sign-up, license verification, and NMLS confirmation — handled in minutes. Start submitting loans the same day.",
    },
    {
      heading: "Submit scenarios and price",
      description:
        "Enter loan details, run pricing scenarios, and share structured rate options with your borrowers — all without picking up the phone.",
    },
    {
      heading: "Track from submission to funding",
      description:
        "Monitor every condition, document, and status update in real time. Your pipeline, your way — no more chasing AEs by email.",
    },
  ],
};

export function HowItWorksSection() {
  const [active, setActive] = useState<Audience>("For Borrowers");
  const { ref, visible } = useInView<HTMLElement>();

  return (
    <section id="how-it-works" className="mkt-section dark" ref={ref}>
      <div className="mkt-section-inner">
        <div className={`mkt-section-header mkt-reveal${visible ? " visible" : ""}`} style={{ maxWidth: "none" }}>
          <span className="mkt-eyebrow-pill">How It Works</span>
          <h2>Simple from the start.</h2>
          <p>
            Whether you&apos;re a first-time borrower or a high-volume broker, Origina
            is designed to get you to a decision faster.
          </p>
        </div>

        <div className={`mkt-hiw-tabs mkt-reveal delay-1${visible ? " visible" : ""}`}>
          {audiences.map((aud) => (
            <button
              key={aud}
              type="button"
              className={`mkt-hiw-tab${active === aud ? " active" : ""}`}
              onClick={() => setActive(aud)}
            >
              {aud}
            </button>
          ))}
        </div>

        <div className={`mkt-steps mkt-reveal delay-2${visible ? " visible" : ""}`}>
          {steps[active].map((step, i) => (
            <div key={step.heading} className="mkt-step">
              <div className="mkt-step-num">{i + 1}</div>
              <h3>{step.heading}</h3>
              <p>{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
