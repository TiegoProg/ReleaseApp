"use client";

// Set de iconos lineales (estilo lucide) dibujados a mano para mantener
// una estética tech-minimal coherente y sin dependencias extra.

import type { SVGProps } from "react";

export type GlyphName =
  // áreas / salas
  | "research"
  | "creative"
  | "content"
  | "media"
  | "director"
  // navegación
  | "home"
  | "briefing"
  | "board"
  | "projects"
  | "network"
  | "settings"
  | "help"
  // utilidades
  | "search"
  | "bell"
  | "arrow-right"
  | "plus"
  | "close"
  | "send"
  | "paperclip"
  | "sparkle"
  | "rocket"
  | "check"
  | "image"
  | "chevron";

const PATHS: Record<GlyphName, JSX.Element> = {
  research: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
      <path d="M11 8.2v5.6M8.2 11h5.6" opacity="0.55" />
    </>
  ),
  creative: (
    <>
      <path d="M12 3l1.8 4.4L18 9l-4.2 1.6L12 15l-1.8-4.4L6 9l4.2-1.6z" />
      <path d="M18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" opacity="0.6" />
    </>
  ),
  content: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <path d="M8.5 8h7M8.5 11.5h7M8.5 15h4" opacity="0.7" />
    </>
  ),
  media: (
    <>
      <path d="M4 19V5" opacity="0.5" />
      <path d="M4 19h16" opacity="0.5" />
      <path d="M7.5 16.5l3.5-4 3 2.5 4.5-6" />
      <path d="M18.5 9V13M18.5 9H14.5" />
    </>
  ),
  director: (
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8.5" opacity="0.45" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2" opacity="0.7" />
    </>
  ),
  home: (
    <>
      <path d="M4 11l8-6.5 8 6.5" />
      <path d="M6 9.5V19h12V9.5" />
      <path d="M10 19v-4.5h4V19" opacity="0.7" />
    </>
  ),
  briefing: (
    <>
      <rect x="5" y="4" width="14" height="16" rx="2.5" />
      <path d="M9 3.5h6v3H9z" />
      <path d="M8.5 12h7M8.5 15.5h4.5" opacity="0.7" />
    </>
  ),
  board: (
    <>
      <rect x="3.5" y="4.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="4.5" width="7" height="5" rx="1.6" opacity="0.75" />
      <rect x="3.5" y="14" width="7" height="5.5" rx="1.6" opacity="0.75" />
      <rect x="13.5" y="11.5" width="7" height="8" rx="1.6" />
    </>
  ),
  projects: (
    <>
      <path d="M4 7.5A1.5 1.5 0 015.5 6h4l2 2.2H19A1.5 1.5 0 0120.5 9.7v8.3A1.5 1.5 0 0119 19.5H5.5A1.5 1.5 0 014 18z" />
    </>
  ),
  network: (
    <>
      <circle cx="12" cy="5" r="2.2" />
      <circle cx="5" cy="18" r="2.2" />
      <circle cx="19" cy="18" r="2.2" />
      <path d="M12 7.2L6.5 16M12 7.2L17.5 16M7 18h10" opacity="0.6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.5M12 19v2.5M21.5 12H19M5 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1L5.3 5.3" opacity="0.7" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.4a2.4 2.4 0 014.4 1.3c0 1.6-2.4 2-2.4 3.3" />
      <path d="M12 17h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6z" />
      <path d="M10 19a2 2 0 004 0" />
    </>
  ),
  "arrow-right": (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12M18 6L6 18" />
    </>
  ),
  send: (
    <>
      <path d="M4.5 12l15.5-7-7 15.5-2.4-6z" />
      <path d="M10.6 14.4L20 5" opacity="0.6" />
    </>
  ),
  paperclip: (
    <>
      <path d="M20 11l-8.5 8.5a4.5 4.5 0 01-6.4-6.4L13 5a3 3 0 014.3 4.2l-8.2 8.2a1.5 1.5 0 01-2.2-2.1l7.6-7.6" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 4l1.4 4.6L18 10l-4.6 1.4L12 16l-1.4-4.6L6 10l4.6-1.4z" />
    </>
  ),
  rocket: (
    <>
      <path d="M5 14c-1.5 1.5-2 5-2 5s3.5-.5 5-2" />
      <path d="M9 15l-1-1c0-4 2.5-8 8.5-9.5C16.5 10.5 13 13 9 15z" />
      <circle cx="14.5" cy="9.5" r="1.4" />
    </>
  ),
  check: (
    <>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </>
  ),
  image: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M5 17l4.5-4 3.5 3 2.5-2.2L20 17" opacity="0.7" />
    </>
  ),
  chevron: (
    <>
      <path d="M9 6l6 6-6 6" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.7,
  ...props
}: { name: GlyphName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
