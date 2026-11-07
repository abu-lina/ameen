import type { Metadata, Viewport } from "next"
import { LanguageProvider } from "@/providers/LanguageProvider"
import "./(frontend)/styles.css"

const title = "Ameen"
const description = "Share your duas anonymously. Strangers pray for you."

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title,
  description,
  openGraph: { title, description },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-zinc-950 antialiased">
        <LanguageProvider>
          <div id="root" tabIndex={-1}>
            {children}
          </div>
        </LanguageProvider>
      </body>
    </html>
  )
}
