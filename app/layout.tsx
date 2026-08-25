import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "Pipiro by Solo México",
    description: "Comida mexicana para la escuela, preparada a tu gusto y entregada a tiempo.",
    applicationName: "Pipiro by Solo México",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Pipiro",
    },
    icons: {
      icon: "/icon-600.png",
      apple: "/icon-600.png",
    },
    openGraph: {
      title: "Pipiro by Solo México",
      description: "Comida mexicana para la escuela, preparada a tu gusto.",
      images: [{ url: `${origin}/og.png`, width: 1731, height: 909 }],
      locale: "es_HN",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Pipiro by Solo México",
      description: "Comida mexicana para la escuela, preparada a tu gusto.",
      images: [`${origin}/og.png`],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#658BD0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-HN">
      <body>{children}</body>
    </html>
  );
}
