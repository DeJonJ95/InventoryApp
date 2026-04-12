import "./globals.css";

export const metadata = {
  title: "Inventory Dashboard",
  description: "Warehouse stock tracking and QR scanning",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
