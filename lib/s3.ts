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
}

export async function uploadToS3(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
  projectId: string
): Promise<string> {
  // Get bucket name from env or use default
  const bucketName = process.env.AWS_S3_BUCKET || 'hearth-hollow-quotes';
  const region = process.env.AWS_REGION || 'us-east-1';
  
  // If S3 is not configured, return a placeholder URL
  if (!s3Client) {
    console.warn("S3 client not initialized, using placeholder URL");
    return `https://placeholder-bucket.s3.amazonaws.com/projects/${projectId}/${filename}`;
  }

  const key = `projects/${projectId}/${crypto.randomBytes(8).toString("hex")}-${filename}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: Buffer.from(buffer),
    ContentType: mimeType,
  });

  try {
    await s3Client.send(command);
    
    // Generate a signed URL that expires in 7 days (604800 seconds)
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    
    const signedUrl = await getSignedUrl(s3Client, getCommand, {
      expiresIn: 604800, // 7 days
    });
    
    console.log(`[S3] Successfully uploaded: ${key}`);
    console.log(`[S3] Signed URL expires in 7 days`);
    
    return signedUrl;
  } catch (error) {
    console.error("S3 upload error:", error);
    // Fallback to placeholder if upload fails
    return `https://placeholder-bucket.s3.amazonaws.com/projects/${projectId}/${filename}`;
  }
}
