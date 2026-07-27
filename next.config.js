/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Playwright is loaded (dynamically) only by the local autofill runner.
    // Keep it external so Next never tries to bundle the browser driver.
    serverComponentsExternalPackages: ["playwright"],
  },
};

module.exports = nextConfig;
