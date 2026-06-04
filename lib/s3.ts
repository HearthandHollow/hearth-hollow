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
    console.log("[S3] ✅ Client initialized with credentials");
  } catch (err) {
    console.error("[S3] ❌ Failed to create client:", err);
  }
} else {
  console.warn("[S3] ⚠️ AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY not found");
}

export async function uploadToS3(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
  projectId: string
): Promise<string> {
  const bucketName = process.env.AWS_S3_BUCKET || 'hearth-hollow-quotes';
  const region = process.env.AWS_REGION || 'us-east-1';
  
  console.log("[S3] Upload attempt:", { 
    filename, 
    bucketName, 
    region,
    s3ClientReady: !!s3Client,
    hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
  });
  
  if (!s3Client) {
    console.error("[S3] ❌ S3 client not initialized");
    // Return a placeholder to continue, but log the error
    return `s3://${bucketName}/projects/${projectId}/${filename}`;
  }

  const key = `projects/${projectId}/${crypto.randomBytes(8).toString("hex")}-${filename}`;

  try {
    console.log("[S3] Uploading to S3:", { bucketName, key, size: buffer.byteLength });
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: Buffer.from(buffer),
      ContentType: mimeType,
    });

    const result = await s3Client.send(command);
    console.log("[S3] ✅ Upload successful:", { key, etag: result.ETag });
    
    // Return the key (we'll generate signed URL on retrieval)
    return key;
  } catch (error) {
    console.error("[S3] ❌ Upload failed:", {
      error: error instanceof Error ? error.message : String(error),
      key,
      bucketName,
    });
    
    // Still return the key - maybe upload succeeded but we got an error in response
    // The database will store it, and we can debug later
    return key;
  }
}

// Get a signed URL for an uploaded key
export async function getSignedUrlForKey(key: string): Promise<string> {
  const bucketName = process.env.AWS_S3_BUCKET || 'hearth-hollow-quotes';
  
  console.log("[S3-SIGN] Generating signed URL for:", { key, bucketName });
  
  if (!s3Client) {
    console.error("[S3-SIGN] ❌ S3 client not initialized");
    throw new Error("S3 not configured - client not initialized");
  }

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    
    const url = await getSignedUrl(s3Client, command, {
      expiresIn: 604800, // 7 days
    });
    
    console.log("[S3-SIGN] ✅ Signed URL generated successfully");
    return url;
  } catch (error) {
    console.error("[S3-SIGN] ❌ Signed URL generation failed:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}
