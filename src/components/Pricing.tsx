"use client";

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for trying out CodeCanvas",
    features: [
      "All core features",
      "Unlimited projects",
      "HTML & CSS export",
      "Community support",
      "Basic templates",
    ],
    cta: "Get Started",
    href: "/canvas",
    popular: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For professional designers & developers",
    features: [
      "Everything in Free",
      "Priority support",
      "Advanced templates",
      "Custom branding",
      "Team collaboration (coming soon)",
      "Version history",
    ],
    cta: "Coming Soon",
    href: "#",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For teams with custom needs",
    features: [
      "Everything in Pro",
      "Custom ML training",
      "Dedicated support",
      "SSO & advanced security",
      "Custom integrations",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
    href: "mailto:sales@codecanvas.com",
    popular: false,
  },
];

export default function Pricing() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-4xl font-bold text-white">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-secondary">
            Choose the plan that's right for you
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {pricingPlans.map((plan) => (
            <div
              key={plan.name}
              className={`relative overflow-hidden rounded-2xl border p-8 transition-all hover:scale-105 ${
                plan.popular
                  ? "glass-orange border-[var(--orange-primary)] shadow-[var(--shadow-orange-glow)]"
                  : "glass border-[var(--grey-700)] hover:border-[var(--grey-600)]"
              }`}
            >
              {plan.popular && (
                <div className="absolute right-4 top-4 rounded-full bg-[var(--orange-primary)] px-3 py-1 text-xs font-bold text-white">
                  POPULAR
                </div>
              )}

              <div className="mb-6">
                <h3 className="mb-2 text-2xl font-bold text-white">{plan.name}</h3>
                <p className="text-sm text-secondary">{plan.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-white">{plan.price}</span>
                  {plan.period && (
                    <span className="text-lg text-secondary">{plan.period}</span>
                  )}
                </div>
              </div>

              <ul className="mb-8 space-y-3">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <svg
                      className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--orange-primary)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-sm text-white">{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href={plan.href}
                className={`btn-base block w-full rounded-xl py-3 text-center font-semibold transition-all ${
                  plan.popular
                    ? "bg-white text-[var(--grey-900)] hover:bg-[var(--grey-100)]"
                    : "glass-light text-white hover:glass"
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        {/* FAQ Link */}
        <div className="mt-12 text-center">
          <p className="text-secondary">
            Have questions?{" "}
            <a href="#faq" className="font-semibold text-[var(--orange-primary)] hover:underline">
              Check our FAQ
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
