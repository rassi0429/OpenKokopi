import { JSX } from "react";

export default function RootLayout({
  children,
}: Readonly<{
  children: JSX.Element | JSX.Element[];
}>) {
  return (
<>
    {children}
</>
  );
}
