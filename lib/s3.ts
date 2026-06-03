import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

let s3Client: S3Client | null = null;

// Only initialize S3 if credentials are available
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

export async function uploadToS3(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
  projectId: string
): Promise<string> {
  // If S3 is not configured, return a placeholder URL
  if (!s3Client || !process.env.AWS_S3_BUCKET) {
    console.warn("S3 not configured, using placeholder URL");
    return `https://placeholder-bucket.s3.amazonaws.com/projects/${projectId}/${filename}`;
  }

  const key = `projects/${projectId}/${crypto.randomBytes(8).toString("hex")}-${filename}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: Buffer.from(buffer),
    ContentType: mimeType,
    // Make the object publicly readable
    ACL: "public-read",
  });

  try {
    await s3Client.send(command);
    return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${key}`;
  } catch (error) {
    console.error("S3 upload error:", error);
    // Fallback to placeholder if upload fails
    return `https://placeholder-bucket.s3.amazonaws.com/projects/${projectId}/${filename}`;
  }
}
