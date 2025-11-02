// src/components/PhoneInput.tsx
import { useEffect, useMemo, useState } from "react";

/** -----------------------------------------------------------
 *  Tipos
 *  --------------------------------------------------------- */
type Dial = {
  iso: string; // ISO-3166-1 alpha-2 (o pseudo para territorios)
  name: string; // Nombre visible
  dial: string; // Código E.164 (ej. "+53")
  example?: string; // Placeholder orientativo
};

export type PhoneInputProps = {
  id?: string;
  value?: string | null; // E.164 (p.ej. +34600111222)
  onChange?: (next: string | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  className?: string;
  defaultIso?: string; // ISO por defecto si value está vacío (ej. "ES", "US", "MX", "CU")
  preferredISOs?: string[]; // ISOs que se muestran arriba como sugeridos
};

/** Convierte "ES" -> 🇪🇸 (emoji flag) */
function isoToFlag(iso: string): string {
  if (!iso || iso.length !== 2) return "🏳️";
  const codePoints = [...iso.toUpperCase()].map(
    (c) => 0x1f1e6 + (c.charCodeAt(0) - 65)
  );
  return String.fromCodePoint(...codePoints);
}

/** -----------------------------------------------------------
 *  Dataset de prefijos (amplio y curado)
 *  (usa el que ya traías, aquí integrado)
 *  --------------------------------------------------------- */
const DIALS: Dial[] = [
  // ——— América del Norte (NANP + otros) ———
  { iso: "US", name: "Estados Unidos", dial: "+1", example: "415 555 2671" },
  { iso: "CA", name: "Canadá", dial: "+1", example: "416 555 1234" },
  { iso: "PR", name: "Puerto Rico", dial: "+1", example: "787 555 1234" },
  {
    iso: "DO",
    name: "República Dominicana",
    dial: "+1",
    example: "809 555 1234",
  },
  { iso: "AG", name: "Antigua y Barbuda", dial: "+1", example: "268 555 1234" },
  { iso: "AI", name: "Anguila", dial: "+1", example: "264 555 1234" },
  { iso: "BB", name: "Barbados", dial: "+1", example: "246 555 1234" },
  { iso: "BM", name: "Bermudas", dial: "+1", example: "441 555 1234" },
  { iso: "BS", name: "Bahamas", dial: "+1", example: "242 555 1234" },
  {
    iso: "VG",
    name: "Islas Vírgenes Británicas",
    dial: "+1",
    example: "284 555 1234",
  },
  { iso: "KY", name: "Islas Caimán", dial: "+1", example: "345 555 1234" },
  { iso: "DM", name: "Dominica", dial: "+1", example: "767 555 1234" },
  { iso: "GD", name: "Granada", dial: "+1", example: "473 555 1234" },
  { iso: "JM", name: "Jamaica", dial: "+1", example: "876 555 1234" },
  {
    iso: "KN",
    name: "San Cristóbal y Nieves",
    dial: "+1",
    example: "869 555 1234",
  },
  { iso: "LC", name: "Santa Lucía", dial: "+1", example: "758 555 1234" },
  { iso: "MS", name: "Montserrat", dial: "+1", example: "664 555 1234" },
  { iso: "SX", name: "Sint Maarten", dial: "+1", example: "721 555 1234" },
  {
    iso: "TC",
    name: "Islas Turcas y Caicos",
    dial: "+1",
    example: "649 555 1234",
  },
  { iso: "TT", name: "Trinidad y Tobago", dial: "+1", example: "868 555 1234" },
  {
    iso: "VI",
    name: "Islas Vírgenes EE. UU.",
    dial: "+1",
    example: "340 555 1234",
  },
  { iso: "GU", name: "Guam", dial: "+1", example: "671 555 1234" },
  { iso: "AS", name: "Samoa Americana", dial: "+1", example: "684 555 1234" },
  {
    iso: "MP",
    name: "Islas Marianas del Norte",
    dial: "+1",
    example: "670 555 1234",
  },

  // ——— Mesoamérica & Caribe (no NANP) ———
  { iso: "MX", name: "México", dial: "+52", example: "55 1234 5678" },
  { iso: "BZ", name: "Belice", dial: "+501", example: "601 2345" },
  { iso: "GT", name: "Guatemala", dial: "+502", example: "5123 4567" },
  { iso: "SV", name: "El Salvador", dial: "+503", example: "7012 3456" },
  { iso: "HN", name: "Honduras", dial: "+504", example: "9123 4567" },
  { iso: "NI", name: "Nicaragua", dial: "+505", example: "8123 4567" },
  { iso: "CR", name: "Costa Rica", dial: "+506", example: "8888 8888" },
  { iso: "PA", name: "Panamá", dial: "+507", example: "6123 4567" },
  { iso: "CU", name: "Cuba", dial: "+53", example: "5 123 4567" },
  { iso: "HT", name: "Haití", dial: "+509", example: "34 10 1234" },

  // ——— Sudamérica ———
  { iso: "AR", name: "Argentina", dial: "+54", example: "11 2345 6789" },
  { iso: "BO", name: "Bolivia", dial: "+591", example: "7123 4567" },
  { iso: "BR", name: "Brasil", dial: "+55", example: "11 91234 5678" },
  { iso: "CL", name: "Chile", dial: "+56", example: "9 1234 5678" },
  { iso: "CO", name: "Colombia", dial: "+57", example: "321 123 4567" },
  { iso: "EC", name: "Ecuador", dial: "+593", example: "99 123 4567" },
  { iso: "GY", name: "Guyana", dial: "+592", example: "609 1234" },
  { iso: "PY", name: "Paraguay", dial: "+595", example: "981 123 456" },
  { iso: "PE", name: "Perú", dial: "+51", example: "912 345 678" },
  { iso: "SR", name: "Surinam", dial: "+597", example: "712 3456" },
  { iso: "UY", name: "Uruguay", dial: "+598", example: "94 123 456" },
  { iso: "VE", name: "Venezuela", dial: "+58", example: "412 123 4567" },
  { iso: "FK", name: "Islas Malvinas", dial: "+500", example: "51234" },

  // ——— Europa Occidental ———
  { iso: "ES", name: "España", dial: "+34", example: "612 34 56 78" },
  { iso: "PT", name: "Portugal", dial: "+351", example: "912 345 678" },
  { iso: "FR", name: "Francia", dial: "+33", example: "06 12 34 56 78" },
  { iso: "DE", name: "Alemania", dial: "+49", example: "1512 3456789" },
  { iso: "IT", name: "Italia", dial: "+39", example: "312 345 6789" },
  { iso: "IE", name: "Irlanda", dial: "+353", example: "085 123 4567" },
  { iso: "GB", name: "Reino Unido", dial: "+44", example: "07123 456789" },
  { iso: "NL", name: "Países Bajos", dial: "+31", example: "06 12345678" },
  { iso: "BE", name: "Bélgica", dial: "+32", example: "0470 12 34 56" },
  { iso: "LU", name: "Luxemburgo", dial: "+352", example: "621 123 456" },
  { iso: "CH", name: "Suiza", dial: "+41", example: "079 123 45 67" },
  { iso: "AT", name: "Austria", dial: "+43", example: "0664 1234567" },
  { iso: "LI", name: "Liechtenstein", dial: "+423", example: "660 123 456" },
  { iso: "MC", name: "Mónaco", dial: "+377", example: "06 12 34 56 78" },
  { iso: "AD", name: "Andorra", dial: "+376", example: "312 345" },
  { iso: "SM", name: "San Marino", dial: "+378", example: "66 123456" },
  { iso: "GI", name: "Gibraltar", dial: "+350", example: "57123456" },

  // ——— Europa Septentrional ———
  { iso: "SE", name: "Suecia", dial: "+46", example: "070 123 45 67" },
  { iso: "NO", name: "Noruega", dial: "+47", example: "412 34 567" },
  { iso: "DK", name: "Dinamarca", dial: "+45", example: "20 12 34 56" },
  { iso: "FI", name: "Finlandia", dial: "+358", example: "040 1234567" },
  { iso: "IS", name: "Islandia", dial: "+354", example: "612 3456" },
  { iso: "FO", name: "Islas Feroe", dial: "+298", example: "211234" },
  { iso: "GL", name: "Groenlandia", dial: "+299", example: "22 12 34" },

  // ——— Europa Central & Oriental ———
  { iso: "PL", name: "Polonia", dial: "+48", example: "512 345 678" },
  { iso: "CZ", name: "Chequia", dial: "+420", example: "601 123 456" },
  { iso: "SK", name: "Eslovaquia", dial: "+421", example: "0903 123 456" },
  { iso: "HU", name: "Hungría", dial: "+36", example: "06 30 123 4567" },
  { iso: "RO", name: "Rumanía", dial: "+40", example: "0712 345 678" },
  { iso: "BG", name: "Bulgaria", dial: "+359", example: "087 123 4567" },
  { iso: "GR", name: "Grecia", dial: "+30", example: "691 234 5678" },
  { iso: "CY", name: "Chipre", dial: "+357", example: "96 123456" },
  { iso: "MT", name: "Malta", dial: "+356", example: "9912 3456" },
  { iso: "LT", name: "Lituania", dial: "+370", example: "612 34567" },
  { iso: "LV", name: "Letonia", dial: "+371", example: "21 234 567" },
  { iso: "EE", name: "Estonia", dial: "+372", example: "5123 4567" },
  { iso: "UA", name: "Ucrania", dial: "+380", example: "050 123 4567" },
  { iso: "BY", name: "Bielorrusia", dial: "+375", example: "29 123 45 67" },
  { iso: "MD", name: "Moldavia", dial: "+373", example: "0621 23 456" },
  { iso: "RS", name: "Serbia", dial: "+381", example: "061 234 5678" },
  { iso: "ME", name: "Montenegro", dial: "+382", example: "067 123 456" },
  { iso: "XK", name: "Kosovo", dial: "+383", example: "049 123 456" },
  { iso: "HR", name: "Croacia", dial: "+385", example: "091 123 4567" },
  { iso: "SI", name: "Eslovenia", dial: "+386", example: "041 234 567" },
  {
    iso: "BA",
    name: "Bosnia y Herzegovina",
    dial: "+387",
    example: "061 123 456",
  },
  {
    iso: "MK",
    name: "Macedonia del Norte",
    dial: "+389",
    example: "070 123 456",
  },

  // ——— Cáucaso & Eurasia ———
  { iso: "RU", name: "Rusia", dial: "+7", example: "912 345 67 89" },
  { iso: "KZ", name: "Kazajistán", dial: "+7", example: "701 123 4567" },
  { iso: "AM", name: "Armenia", dial: "+374", example: "091 23 45 67" },
  { iso: "AZ", name: "Azerbaiyán", dial: "+994", example: "050 123 45 67" },
  { iso: "GE", name: "Georgia", dial: "+995", example: "555 12 34 56" },

  // ——— Oriente Medio ———
  { iso: "TR", name: "Turquía", dial: "+90", example: "0531 234 56 78" },
  { iso: "IL", name: "Israel", dial: "+972", example: "052 123 4567" },
  { iso: "PS", name: "Palestina", dial: "+970", example: "059 123 4567" },
  { iso: "LB", name: "Líbano", dial: "+961", example: "71 123 456" },
  { iso: "SY", name: "Siria", dial: "+963", example: "093 123 4567" },
  { iso: "JO", name: "Jordania", dial: "+962", example: "07 9 123 4567" },
  { iso: "IQ", name: "Irak", dial: "+964", example: "0790 123 4567" },
  { iso: "KW", name: "Kuwait", dial: "+965", example: "500 12345" },
  { iso: "SA", name: "Arabia Saudita", dial: "+966", example: "055 123 4567" },
  { iso: "YE", name: "Yemen", dial: "+967", example: "711 234 567" },
  { iso: "OM", name: "Omán", dial: "+968", example: "9212 3456" },
  {
    iso: "AE",
    name: "Emiratos Árabes Unidos",
    dial: "+971",
    example: "050 123 4567",
  },
  { iso: "BH", name: "Baréin", dial: "+973", example: "3600 1234" },
  { iso: "QA", name: "Catar", dial: "+974", example: "3312 3456" },
  { iso: "IR", name: "Irán", dial: "+98", example: "0912 345 6789" },

  // ——— Asia Sur ———
  { iso: "IN", name: "India", dial: "+91", example: "09876 123456" },
  { iso: "PK", name: "Pakistán", dial: "+92", example: "0301 2345678" },
  { iso: "AF", name: "Afganistán", dial: "+93", example: "070 123 4567" },
  { iso: "LK", name: "Sri Lanka", dial: "+94", example: "071 234 5678" },
  { iso: "MM", name: "Myanmar", dial: "+95", example: "09 123 456789" },
  { iso: "MV", name: "Maldivas", dial: "+960", example: "771 2345" },
  { iso: "NP", name: "Nepal", dial: "+977", example: "981 234 5678" },
  { iso: "BT", name: "Bután", dial: "+975", example: "1712 3456" },
  { iso: "BD", name: "Bangladés", dial: "+880", example: "017 12 345 678" },

  // ——— Asia Oriental ———
  { iso: "CN", name: "China", dial: "+86", example: "138 0013 8000" },
  { iso: "TW", name: "Taiwán", dial: "+886", example: "0912 345 678" },
  { iso: "HK", name: "Hong Kong", dial: "+852", example: "5123 4567" },
  { iso: "MO", name: "Macao", dial: "+853", example: "6612 3456" },
  { iso: "KR", name: "Corea del Sur", dial: "+82", example: "010 1234 5678" },
  { iso: "JP", name: "Japón", dial: "+81", example: "090 1234 5678" },
  { iso: "KP", name: "Corea del Norte", dial: "+850", example: "191 234 5678" },
  { iso: "MN", name: "Mongolia", dial: "+976", example: "8812 3456" },

  // ——— Sudeste Asiático ———
  { iso: "SG", name: "Singapur", dial: "+65", example: "8123 4567" },
  { iso: "MY", name: "Malasia", dial: "+60", example: "012 345 6789" },
  { iso: "TH", name: "Tailandia", dial: "+66", example: "081 234 5678" },
  { iso: "PH", name: "Filipinas", dial: "+63", example: "0917 123 4567" },
  { iso: "ID", name: "Indonesia", dial: "+62", example: "0812 3456 7890" },
  { iso: "VN", name: "Vietnam", dial: "+84", example: "091 234 56 78" },
  { iso: "KH", name: "Camboya", dial: "+855", example: "012 345 678" },
  { iso: "LA", name: "Laos", dial: "+856", example: "020 23 456 789" },
  { iso: "BN", name: "Brunéi", dial: "+673", example: "712 3456" },
  { iso: "TL", name: "Timor Oriental", dial: "+670", example: "7721 2345" },

  // ——— Oceanía ———
  { iso: "AU", name: "Australia", dial: "+61", example: "0412 345 678" },
  { iso: "NZ", name: "Nueva Zelanda", dial: "+64", example: "021 123 4567" },
  { iso: "PG", name: "Papúa Nueva Guinea", dial: "+675", example: "7012 3456" },
  { iso: "SB", name: "Islas Salomón", dial: "+677", example: "74 12345" },
  { iso: "VU", name: "Vanuatu", dial: "+678", example: "591 2345" },
  { iso: "FJ", name: "Fiyi", dial: "+679", example: "701 2345" },
  { iso: "PW", name: "Palaos", dial: "+680", example: "620 1234" },
  { iso: "WF", name: "Wallis y Futuna", dial: "+681", example: "72 12 34" },
  { iso: "CK", name: "Islas Cook", dial: "+682", example: "71 234" },
  { iso: "NU", name: "Niue", dial: "+683", example: "1234" },
  { iso: "WS", name: "Samoa", dial: "+685", example: "721 2345" },
  { iso: "KI", name: "Kiribati", dial: "+686", example: "72012" },
  { iso: "NC", name: "Nueva Caledonia", dial: "+687", example: "75 12 34" },
  { iso: "TV", name: "Tuvalu", dial: "+688", example: "90123" },
  {
    iso: "PF",
    name: "Polinesia Francesa",
    dial: "+689",
    example: "87 12 34 56",
  },
  { iso: "TK", name: "Tokelau", dial: "+690", example: "1234" },
  { iso: "FM", name: "Micronesia", dial: "+691", example: "350 1234" },
  { iso: "MH", name: "Islas Marshall", dial: "+692", example: "235 1234" },
  { iso: "NF", name: "Isla Norfolk", dial: "+672", example: "3 81234" },

  // ——— África ———
  { iso: "EG", name: "Egipto", dial: "+20", example: "010 123 45678" },
  { iso: "DZ", name: "Argelia", dial: "+213", example: "0551 23 45 67" },
  { iso: "MA", name: "Marruecos", dial: "+212", example: "06 12 34 56 78" },
  {
    iso: "EH",
    name: "Sahara Occidental",
    dial: "+212",
    example: "06 12 34 56 78",
  },
  { iso: "TN", name: "Túnez", dial: "+216", example: "20 123 456" },
  { iso: "LY", name: "Libia", dial: "+218", example: "091 234 5678" },
  { iso: "GM", name: "Gambia", dial: "+220", example: "301 2345" },
  { iso: "SN", name: "Senegal", dial: "+221", example: "70 123 45 67" },
  { iso: "MR", name: "Mauritania", dial: "+222", example: "22 12 34 56" },
  { iso: "ML", name: "Mali", dial: "+223", example: "65 12 34 56" },
  { iso: "GN", name: "Guinea", dial: "+224", example: "621 12 34 56" },
  { iso: "CI", name: "Costa de Marfil", dial: "+225", example: "07 12 34 56" },
  { iso: "BF", name: "Burkina Faso", dial: "+226", example: "70 12 34 56" },
  { iso: "NE", name: "Níger", dial: "+227", example: "93 12 34 56" },
  { iso: "TG", name: "Togo", dial: "+228", example: "90 12 34 56" },
  { iso: "BJ", name: "Benín", dial: "+229", example: "90 12 34 56" },
  { iso: "MU", name: "Mauricio", dial: "+230", example: "5251 2345" },
  { iso: "LR", name: "Liberia", dial: "+231", example: "077 012 3456" },
  { iso: "SL", name: "Sierra Leona", dial: "+232", example: "076 123456" },
  { iso: "GH", name: "Ghana", dial: "+233", example: "024 123 4567" },
  { iso: "NG", name: "Nigeria", dial: "+234", example: "0803 123 4567" },
  { iso: "TD", name: "Chad", dial: "+235", example: "66 12 34 56" },
  {
    iso: "CF",
    name: "Rep. Centroafricana",
    dial: "+236",
    example: "72 12 34 56",
  },
  { iso: "CM", name: "Camerún", dial: "+237", example: "6 71 23 45 67" },
  { iso: "CV", name: "Cabo Verde", dial: "+238", example: "991 12 34" },
  {
    iso: "ST",
    name: "Santo Tomé y Príncipe",
    dial: "+239",
    example: "90 12345",
  },
  {
    iso: "GQ",
    name: "Guinea Ecuatorial",
    dial: "+240",
    example: "222 123 456",
  },
  { iso: "GA", name: "Gabón", dial: "+241", example: "06 12 34 56" },
  { iso: "CG", name: "Congo", dial: "+242", example: "06 612 34 56" },
  {
    iso: "CD",
    name: "Rep. Dem. del Congo",
    dial: "+243",
    example: "099 123 4567",
  },
  { iso: "AO", name: "Angola", dial: "+244", example: "923 123 456" },
  { iso: "GW", name: "Guinea-Bisáu", dial: "+245", example: "955 123 456" },
  {
    iso: "IO",
    name: "Terr. Británico Océano Índico",
    dial: "+246",
    example: "1234",
  },
  { iso: "SC", name: "Seychelles", dial: "+248", example: "2 510 123" },
  { iso: "SD", name: "Sudán", dial: "+249", example: "091 123 4567" },
  { iso: "RW", name: "Ruanda", dial: "+250", example: "0720 123 456" },
  { iso: "ET", name: "Etiopía", dial: "+251", example: "091 123 4567" },
  { iso: "SO", name: "Somalia", dial: "+252", example: "61 234 5678" },
  { iso: "DJ", name: "Yibuti", dial: "+253", example: "77 12 34 56" },
  { iso: "KE", name: "Kenia", dial: "+254", example: "0712 345 678" },
  { iso: "TZ", name: "Tanzania", dial: "+255", example: "0712 345 678" },
  { iso: "UG", name: "Uganda", dial: "+256", example: "0712 345 678" },
  { iso: "BI", name: "Burundi", dial: "+257", example: "79 12 34 56" },
  { iso: "MZ", name: "Mozambique", dial: "+258", example: "82 123 4567" },
  { iso: "ZM", name: "Zambia", dial: "+260", example: "095 5 123456" },
  { iso: "MG", name: "Madagascar", dial: "+261", example: "032 12 345 67" },
  { iso: "RE", name: "Reunión", dial: "+262", example: "0692 12 34 56" },
  { iso: "YT", name: "Mayotte", dial: "+262", example: "0639 12 34 56" },
  { iso: "ZW", name: "Zimbabue", dial: "+263", example: "071 234 5678" },
  { iso: "NA", name: "Namibia", dial: "+264", example: "081 234 5678" },
  { iso: "MW", name: "Malaui", dial: "+265", example: "099 123 4567" },
  { iso: "LS", name: "Lesoto", dial: "+266", example: "5012 3456" },
  { iso: "BW", name: "Botsuana", dial: "+267", example: "71 123 456" },
  { iso: "SZ", name: "Esuatini", dial: "+268", example: "7612 3456" },
  { iso: "KM", name: "Comoras", dial: "+269", example: "321 23 45" },
  { iso: "ZA", name: "Sudáfrica", dial: "+27", example: "082 123 4567" },
  { iso: "SS", name: "Sudán del Sur", dial: "+211", example: "0912 345 678" },
  { iso: "ER", name: "Eritrea", dial: "+291", example: "07 123 456" },
  { iso: "SH", name: "Santa Elena", dial: "+290", example: "5 1234" },
  { iso: "AC", name: "Ascensión", dial: "+247", example: "62 1234" },

  // ——— Territorios franceses extra ———
  { iso: "GP", name: "Guadalupe", dial: "+590", example: "0690 12 34 56" },
  { iso: "BL", name: "San Bartolomé", dial: "+590", example: "0690 12 34 56" },
  {
    iso: "MF",
    name: "San Martín (FR)",
    dial: "+590",
    example: "0690 12 34 56",
  },
  {
    iso: "GF",
    name: "Guayana Francesa",
    dial: "+594",
    example: "0694 12 34 56",
  },
  { iso: "MQ", name: "Martinica", dial: "+596", example: "0696 12 34 56" },
  {
    iso: "PM",
    name: "San Pedro y Miquelón",
    dial: "+508",
    example: "41 12 34",
  },
];

/** Orden auxiliar para detectar prefijos (probar primero más largos) */
const DIALS_BY_LENGTH_DESC = [...DIALS].sort(
  (a, b) => b.dial.length - a.dial.length
);

/** Busca dial por ISO */
function dialByIso(iso?: string | null): string | null {
  if (!iso) return null;
  const up = iso.toUpperCase();
  const found = DIALS.find((d) => d.iso === up);
  return found ? found.dial : null;
}

/** Heurística: deduce ISO por locale del navegador (ej. "es-MX" => "MX") */
function guessIsoFromNavigator(): string | null {
  const lang = typeof navigator !== "undefined" ? navigator.language : "";
  const m = lang && lang.match(/[-_]([A-Za-z]{2})$/);
  return m ? m[1].toUpperCase() : null;
}

/** Divide E.164 en {dial, local}. Si no es E.164, usa fallbackDial. */
function splitE164(
  value?: string | null,
  fallbackDial: string = "+34"
): { dial: string; local: string } {
  const v = (value || "").trim();
  if (!v.startsWith("+")) return { dial: fallbackDial, local: "" };
  const match = DIALS_BY_LENGTH_DESC.find((d) => v.startsWith(d.dial));
  if (match) return { dial: match.dial, local: v.slice(match.dial.length) };
  return { dial: fallbackDial, local: v.replace(/^\+/, "") };
}

/** Composición a E.164, máximo 15 dígitos (sin '+'). */
function composeE164(dial: string, localDigits: string): string | null {
  const clean = localDigits.replace(/\D+/g, "");
  if (!clean) return null;
  const totalDigits = (dial.replace("+", "") + clean).length;
  if (totalDigits > 15) {
    const compact = (dial + clean).replace(/\+/g, "").slice(0, 15);
    return `+${compact}`;
  }
  return `${dial}${clean}`;
}

/** -----------------------------------------------------------
 *  Componente
 *  --------------------------------------------------------- */
export default function PhoneInput({
  id,
  value,
  onChange,
  label = "Teléfono",
  placeholder,
  disabled,
  required,
  error,
  className = "",
  defaultIso,
  preferredISOs = [],
}: PhoneInputProps) {
  // Dial por defecto si no hay value:
  const defaultDial = useMemo(() => {
    const fromProp = dialByIso(defaultIso);
    if (fromProp) return fromProp;
    const fromLocale = dialByIso(guessIsoFromNavigator());
    return fromLocale || "+34"; // fallback España
  }, [defaultIso]);

  const { dial: initDial, local: initLocal } = useMemo(
    () => splitE164(value, defaultDial),
    [value, defaultDial]
  );

  const [dial, setDial] = useState<string>(initDial);
  const [local, setLocal] = useState<string>(initLocal);

  useEffect(() => {
    const s = splitE164(value, defaultDial);
    setDial(s.dial);
    setLocal(s.local);
  }, [value, defaultDial]);

  // Sugeridos vs resto
  const preferredSet = useMemo(
    () => new Set(preferredISOs.map((x) => x.toUpperCase())),
    [preferredISOs]
  );
  const suggested = useMemo(
    () => DIALS.filter((d) => preferredSet.has(d.iso)),
    [preferredSet]
  );
  const rest = useMemo(
    () => DIALS.filter((d) => !preferredSet.has(d.iso)),
    [preferredSet]
  );

  const selected = useMemo(
    () =>
      DIALS.find((d) => d.dial === dial) ||
      DIALS.find((d) => d.dial === defaultDial)!,
    [dial, defaultDial]
  );

  function handleDialChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nd = e.target.value;
    setDial(nd);
    onChange?.(composeE164(nd, local));
  }

  function handleLocalChange(e: React.ChangeEvent<HTMLInputElement>) {
    const ndigits = e.currentTarget.value.replace(/[^\d\s\-().]/g, "");
    setLocal(ndigits);
    onChange?.(composeE164(dial, ndigits));
  }

  const ph = selected?.example || placeholder || "Número";

  // Etiquetas
  const selectedShortLabel = `${isoToFlag(selected.iso)} ${selected.dial}`; // (cerrado) bandera + prefijo
  const optionLabel = (d: Dial) => `${isoToFlag(d.iso)} ${d.name} (${d.dial})`; // (lista) bandera + país + prefijo

  return (
    <div className={`grid gap-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium">
          {label} {required ? <span className="opacity-60">*</span> : null}
        </label>
      )}

      <div className="flex gap-2 items-stretch">
        {/* Wrapper con overlay para mostrar solo bandera + prefijo cuando el select está cerrado */}
        <div className="relative">
          {/* Overlay visible (cerrado) */}
          <div
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm"
            aria-hidden="true"
          >
            {selectedShortLabel}
          </div>

          {/* Select nativo (opciones completas). Hacemos el texto transparente para que no duplique con el overlay */}
          <select
            className="min-w-[210px] appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface-1)] py-2 pl-[108px] pr-8 text-sm text-transparent"
            value={dial}
            onChange={handleDialChange}
            disabled={disabled}
            aria-label="Prefijo telefónico"
          >
            {suggested.length > 0 && (
              <optgroup label="Recomendados">
                {suggested.map((d) => (
                  <option key={`pref-${d.iso}-${d.dial}`} value={d.dial}>
                    {optionLabel(d)}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={suggested.length ? "Todos los países" : "País"}>
              {rest.map((d) => (
                <option key={`${d.iso}-${d.dial}`} value={d.dial}>
                  {optionLabel(d)}
                </option>
              ))}
            </optgroup>
          </select>

          {/* caret */}
          <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-70">
            ▾
          </div>
        </div>

        {/* Número local */}
        <input
          id={id}
          inputMode="tel"
          pattern="[0-9\s\-().]*"
          className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm"
          placeholder={ph}
          value={local}
          onChange={handleLocalChange}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
        />
      </div>

      <div className="text-xs opacity-70" aria-live="polite">
        Se guardará como internacional (E.164):{" "}
        <b>{composeE164(dial, local) || "—"}</b>
      </div>

      {error ? (
        <div id={`${id}-err`} className="text-xs text-red-400">
          {error}
        </div>
      ) : null}
    </div>
  );
}
