import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  // Agent prompts are read from agents/*.md at runtime; ship them with every server function.
  outputFileTracingIncludes: { "/**": ["./agents/**/*"] },
};

export default nextConfig;
