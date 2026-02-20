import "../styles/globals.css";
export const metadata = { title: "Raise TON" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="ru"><body><div className="appShell">{children}</div></body></html>);
}
