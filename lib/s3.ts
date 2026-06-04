import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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
  console.log("[S3] Client initialized");
}

export async function uploadToS3(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
  projectId: string
): Promise<string> {
  const bucketName = process.env.AWS_S3_BUCKET || 'hearth-hollow-quotes';
  const region = process.env.AWS_REGION || 'us-east-1';
  
  if (!s3Client) {
    console.warn("[S3] Client not initialized");
    throw new Error("S3 not configured");
  }

  const key = `projects/${projectId}/${crypto.randomBytes(8).toString("hex")}-${filename}`;

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: Buffer.from(buffer),
      ContentType: mimeType,
    });

    await s3Client.send(command);
    console.log("[S3] Uploaded:", key);
    
    // Store the key (we'll generate signed URL on retrieval)
    return key;
  } catch (error) {
    console.error("[S3] Upload failed:", error);
    throw error;
  }
}

// Get a signed URL for an uploaded key
export async function getSignedUrlForKey(key: string): Promise<string> {
  const bucketName = process.env.AWS_S3_BUCKET || 'hearth-hollow-quotes';
  
  if (!s3Client) {
    throw new Error("S3 not configured");
  }

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    
    const url = await getSignedUrl(s3Client, command, {
      expiresIn: 604800, // 7 days
    });
    
    return url;
  } catch (error) {
    console.error("[S3] Signed URL failed:", error);
    throw error;
  }
}
