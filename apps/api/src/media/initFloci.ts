import {
  CreateBucketCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const endpoint = process.env.S3_ENDPOINT ?? "http://127.0.0.1:4566";
const region = process.env.AWS_REGION ?? "us-east-1";
const bucket = process.env.MEDIA_BUCKET ?? "pixelpushr-media";
const origin = process.env.PUBLIC_WEB_URL ?? "http://127.0.0.1:5173";
const client = new S3Client({
  endpoint,
  region,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "test",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "test",
  },
});

try {
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
} catch (error) {
  if (
    !(error instanceof Error) ||
    !["BucketAlreadyOwnedByYou", "BucketAlreadyExists"].includes(error.name)
  )
    throw error;
}
await client.send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: [origin],
          AllowedMethods: ["GET", "HEAD", "PUT"],
          AllowedHeaders: ["*"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }),
);
await client.send(
  new PutBucketPolicyCommand({
    Bucket: bucket,
    Policy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "PublicPlayback",
          Effect: "Allow",
          Principal: "*",
          Action: "s3:GetObject",
          Resource: `arn:aws:s3:::${bucket}/*`,
        },
      ],
    }),
  }),
);
console.info(`Local media bucket ${bucket} is ready`);
