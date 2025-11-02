export default function Container({ children, className = "" }: any) {
  return <div className={`container ${className}`}>{children}</div>;
}
