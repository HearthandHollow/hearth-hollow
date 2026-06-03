import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function uploadToS3(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
  projectId: string
): Promise<string> {
  const key = `projects/${projectId}/${crypto.randomBytes(8).toString("hex")}-${filename}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET || "handyman-quotes",
    Key: key,
    Body: Buffer.from(buffer),
    ContentType: mimeType,
  });

  try {
    await s3Client.send(command);
    return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  } catch (error) {
    console.error("S3 upload error:", error);
    throw error;
  }
}
