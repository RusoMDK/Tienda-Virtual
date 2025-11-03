// src/features/uploads/cldUrl.ts
// Dado un publicId o URL de Cloudinary, devuelve una versión transformada responsive
export function cldThumb(
  input: { publicId?: string; url?: string },
  opts: { w?: number; h?: number; fit?: "fill" | "fit"; g?: "auto" } = {}
) {
  const { w = 480, h = 360, fit = "fill", g = "auto" } = opts;
  const isUrl = !!input.url;
  // Intenta extraer cloudName y publicId desde URL ya guardada (si no pasas publicId)
  const url = input.url || "";
  let cloudName = "";
  let publicId = input.publicId || "";
  try {
    const u = new URL(url);
    const m = u.pathname.match(/^\/([^/]+)\/image\/upload\/(.+)$/); // /<cloud>/image/upload/<path>
    if (!publicId && m) {
      cloudName = m[1];
      publicId = m[2].replace(/^v\d+\//, "").replace(/\.[a-z0-9]+$/i, "");
    }
    if (!cloudName) {
      // si no lo pudimos inferir, usa tu VITE_*
      cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    }
  } catch {
    cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  }
  if (!cloudName || !publicId) return input.url || "";

  const tf = [
    "f_auto", // formato óptimo
    "q_auto", // calidad automática
    `c_${fit}`, // crop/fit
    `g_${g}`, // gravity
    `w_${w}`,
    `h_${h}`,
  ].join(",");

  return `https://res.cloudinary.com/${cloudName}/image/upload/${tf}/${publicId}`;
}
