import type { Metadata } from "next";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Partner Portal",
  description: "Partner portal for resellers and co-sell partners",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <html lang="en">
      <body className="font-sans bg-white text-gray-900 antialiased">
        <nav className="border-b border-gray-200 px-8 py-4 flex items-center gap-6">
          <Link href="/" className="font-semibold text-gray-900">
            Partner Portal
          </Link>
          {session?.partnerCompanyId && (
            <>
              <Link
                href="/deals"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Deals
              </Link>
              <Link
                href="/mdf"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                MDF
              </Link>
              <Link
                href="/co-sell"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Co-Sell
              </Link>
              <Link
                href="/accounts"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Accounts
              </Link>
              <div className="ml-auto flex items-center gap-3">
                <span className="text-sm text-gray-700 font-medium">
                  {session.partnerCompanyName}
                </span>
                {session.partnerTier && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                    {session.partnerTier}
                  </span>
                )}
                <form action={handleSignOut}>
                  <button
                    type="submit"
                    className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                  >
                    Sign Out
                  </button>
                </form>
              </div>
            </>
          )}
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
