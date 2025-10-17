  import { NextIntlClientProvider, hasLocale } from "next-intl";
  import { notFound } from "next/navigation";
  import { routing } from "@/i18n/routing";
  import PageTransition from "@/components/ui/PageTransition";
  import Navbar from "@/components/layout/Navbar";
  import LoadingWrapper from "@/components/ui/LoadingWrapper";
  import "@fortawesome/fontawesome-free/css/all.min.css";
  import BootstrapStyle from "@/components/ui/BootstrapStyle";
  import "../styles/globals.css"; // الـ CSS العام

  export const metadata = {
    title: {
      template: "%s | Jelly Fish",
      default: "Jelly Fish",
    },
    description: "Your application description",
    keywords: ["nextjs", "internationalization", "rtl"],
    authors: [{ name: "Your Name" }],
    robots: "index, follow",
  };

  export const viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: "#ffffff" },
      { media: "(prefers-color-scheme: dark)", color: "#000000" },
    ],
  };

  export default async function RootLayout({ children, params }) {
    const { locale } = await params;
    const localeString = String(locale);

    if (!hasLocale(routing.locales, localeString)) {
      notFound();
    }

    const isRTL = localeString === "ar";

    return (
      <html
        lang={localeString}
        dir={isRTL ? "rtl" : "ltr"}
        suppressHydrationWarning
        className={isRTL ? "rtl" : "ltr"}
        data-scroll-behavior="smooth"
      >

        <body suppressHydrationWarning className={isRTL ? "rtl" : "ltr"}>
          <NextIntlClientProvider locale={localeString}>
            <BootstrapStyle />
            <LoadingWrapper>
              <div className="min-h-screen flex flex-col">
                <Navbar />
                <main className="flex-1">
                  <PageTransition>{children}</PageTransition>
                </main>
              </div>
            </LoadingWrapper>
          </NextIntlClientProvider> 

          {process.env.NODE_ENV === "production" && (
            <>{/* Add your analytics scripts here */}</>
          )}
        </body>
      </html>
    );
  }

  export async function generateStaticParams() {
    return routing.locales.map((locale) => ({
      locale: locale,
    }));
  }
