import { InputHTMLAttributes } from "react";

export default function Checkbox(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      {...props}
      className="h-4 w-4 rounded align-middle outline-none
                 bg-[rgb(var(--card-rgb))] border border-[rgb(var(--line-rgb))]
                 accent-[rgb(var(--primary-rgb))] focus-visible:ring-2 ring-[rgb(var(--primary-rgb)/0.35)]"
    />
  );
}
