import type { Metadata } from "next";

import Link from "next/link";

import { STORE_BRAND, TERMS_VERSION } from "@/lib/shop/config";

export const metadata: Metadata = {
  title: `Terms and Conditions | ${STORE_BRAND}`,
  description: `Terms of use, purchase rules, and support guidelines for ${STORE_BRAND}.`,
};

const sections = [
  {
    title: "Use of the Service",
    paragraphs: [
      `${STORE_BRAND} operates a digital store where customers can browse products, create an account, request delivery, schedule pickup, and contact support through the website.`,
      "Customers must provide real, updated, and sufficient information so orders, deliveries, pickups, and support requests can be processed correctly.",
      "The store may reject, pause, or cancel an order when it detects incomplete information, suspicious activity, stock issues, operational errors, or a real inability to fulfill the request.",
    ],
  },
  {
    title: "Orders and Confirmation",
    paragraphs: [
      "Every order remains subject to operational validation, real product availability, delivery coverage, schedule availability, and final confirmation methods.",
      "Orders scheduled for pickup must follow the selected location, date, and any applicable amount due at delivery or pickup time.",
      "If an order requires a confirmation call or manual review, the store may contact the customer before final preparation is completed.",
    ],
  },
  {
    title: "Payments and Prices",
    paragraphs: [
      "Published prices are the prices visible to the customer in the store and may change without prior notice before the final order confirmation.",
      "Delivery costs, promotions, availability, and special conditions are calculated according to the real order details and the active store configuration.",
      "The store may correct clear pricing, description, or inventory errors before dispatch or pickup is completed.",
    ],
  },
  {
    title: "No-Refund Policy",
    paragraphs: [
      "This website does not provide refunds for items once they have been processed, delivered, or picked up, unless the store decides otherwise because of a verified error caused exclusively by the operation.",
      "The store will try to help resolve reasonable issues related to orders, product condition on arrival, preparation mistakes, missing items, or incidents reported on time.",
      "Return or refund requests will not be accepted for change of mind, incorrect use, damage after delivery, normal wear, or failure to follow product instructions.",
    ],
  },
  {
    title: "Support and Reports",
    paragraphs: [
      "Customers may contact support through the website to report a problem, request assistance, or ask about the status of an order.",
      "The store may retain chat history, emails, and relevant order updates for operational, security, and follow-up purposes.",
      "Reports must describe the issue clearly and include enough information for the team to review the case.",
    ],
  },
  {
    title: "Customer Responsibilities",
    paragraphs: [
      "Keep account access, email, and credentials secure.",
      "Provide correct address, phone number, and email information during registration and checkout.",
      "Be available for delivery or appear at the pickup location within the agreed schedule.",
      "Review the order summary carefully before confirming the purchase.",
    ],
  },
  {
    title: "Store Responsibilities",
    paragraphs: [
      "Publish active products, manage orders based on real availability, and maintain working support channels.",
      "Reasonably protect account information and never store passwords in plain text.",
      "Try to resolve operational incidents reported by the customer within a reasonable service window.",
    ],
  },
  {
    title: "Accounts and Access",
    paragraphs: [
      "Creating an account requires explicit acceptance of these terms and conditions of use.",
      "The store may block or restrict accounts associated with fraud, abuse, impersonation, misuse of support, or serious violations of these conditions.",
      `Current terms version: ${TERMS_VERSION}.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 lg:px-10">
        <div className="rounded-[2.5rem] border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_38%),linear-gradient(180deg,_#050816_0%,_#03050f_100%)] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.4)]">
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Legal</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
            Terms and Conditions of Use
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
            These terms govern general use of the store, account creation, orders, the no-refund
            policy, and how customer incidents are handled.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm font-semibold text-white transition hover:border-cyan-500"
            >
              Back to the store
            </Link>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-[2rem] border border-slate-800 bg-[#0a1020] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.28)]"
            >
              <h2 className="text-xl font-semibold text-white">{section.title}</h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-slate-300">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
