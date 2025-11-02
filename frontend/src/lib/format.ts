export const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
