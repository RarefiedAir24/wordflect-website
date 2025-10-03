import type { NextConfig } from "next";

// Trigger Vercel redeploy: image domains config for S3 profile and frame images
// See: https://vercel.com/docs/concepts/projects/environment-variables#automatic-deployments
// Last updated: to force redeploy with session words endpoint fix

const nextConfig: NextConfig = {
  images: {
    domains: [
      'wordflect-profile-images.s3.amazonaws.com',
      'wordflect-profile-images.s3.us-east-2.amazonaws.com',
      'wordflect-avatar-frames.s3.us-east-2.amazonaws.com'
    ]
  }
};

export default nextConfig;
