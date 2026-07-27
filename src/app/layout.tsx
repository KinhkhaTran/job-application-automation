export const metadata = {
  title: "Job Application Automation",
  description: "Personal new-grad SWE job tracker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
