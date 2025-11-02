export default function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[13px] mb-1 text-[rgb(var(--fg-rgb)/0.85)]"
    >
      {children}
    </label>
  );
}
