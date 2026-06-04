import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

let s3Client: S3Client | null = null;

// Only initialize S3 if credentials are available
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  try {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    console.log("[S3] ✅ Client initialized");
  } catch (err) {
    console.error("[S3] ❌ Failed to create client:", err);
  }
} else {
  console.warn("[S3] ⚠️ AWS credentials not found");
}

export async function uploadToS3(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
  projectId: string
): Promise<string> {
  const bucketName = process.env.AWS_S3_BUCKET || 'hearth-hollow-quotes';
  const region = process.env.AWS_REGION || 'us-east-1';
  
  console.log("[S3] Upload start:", { filename, bucketName, s3ClientReady: !!s3Client });
  
  if (!s3Client) {
    console.error("[S3] ❌ S3 client not initialized - missing credentials");
    throw new Error("S3 not configured - AWS credentials missing");
  }

  const key = `projects/${projectId}/${crypto.randomBytes(8).toString("hex")}-${filename}`;

  try {
    console.log("[S3] Uploading to:", { bucketName, key });
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: Buffer.from(buffer),
      ContentType: mimeType,
    });

    const result = await s3Client.send(command);
    console.log("[S3] ✅ Upload successful:", key);
    
    // Return the key (we'll generate signed URL on retrieval)
    return key;
  } catch (error) {
    console.error("[S3] ❌ Upload failed:", error);
    throw new Error(`S3 upload failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Get a signed URL for an uploaded key
export async function getSignedUrlForKey(key: string): Promise<string> {
  const bucketName = process.env.AWS_S3_BUCKET || 'hearth-hollow-quotes';
  
  console.log("[S3] Generating signed URL for:", key);
  
  if (!s3Client) {
    console.error("[S3] ❌ S3 client not initialized");
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
    
    console.log("[S3] ✅ Signed URL generated");
    return url;
  } catch (error) {
    console.error("[S3] ❌ Signed URL failed:", error);
    throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}
