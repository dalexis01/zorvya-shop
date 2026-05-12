import styles from "./DeliveryEstimateBadge.module.css";

export default function DeliveryEstimateBadge({
  text,
  variant = "card",
  className = "",
}: {
  text: string;
  variant?: "card" | "panel";
  className?: string;
}) {
  const badgeClass = variant === "panel" ? styles.panel : styles.card;
  const textClass = variant === "panel" ? styles.panelText : "";

  return (
    <div className={[styles.badge, badgeClass, className].filter(Boolean).join(" ")}>
      <span aria-hidden="true" className={styles.dot} />
      <span className={[styles.text, textClass].filter(Boolean).join(" ")}>{text}</span>
    </div>
  );
}
