import type { AppProps } from "next/app";
import Head from "next/head";
import { AuthProvider } from "@/state/auth";
import "@/styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Head>
        <link rel="icon" href="/origina-logo-mark.webp" type="image/webp" />
        <meta name="theme-color" content="#07130b" />
      </Head>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
