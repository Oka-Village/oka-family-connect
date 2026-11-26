import { Link } from "@tanstack/react-router";

type Props = {
  current: "events" | "pods";
};

export function EventsPodsSeg({ current }: Props) {
  return (
    <nav className="pods-seg" aria-label="Events and pods">
      <Link to="/events" aria-current={current === "events" ? "page" : undefined}>
        Events
      </Link>
      <Link to="/pods" aria-current={current === "pods" ? "page" : undefined}>
        Pods
      </Link>
    </nav>
  );
}
