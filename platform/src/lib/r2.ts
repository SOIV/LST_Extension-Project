import { ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

/**
 * R2에 파일 업로드
 * @param key - 저장 경로 (예: subtitles/videoId/ko/1.srt)
 * @param content - 파일 내용
 * @param contentType - MIME 타입
 */
export async function uploadToR2(
  key: string,
  content: string,
  contentType: string
) {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: content,
      ContentType: contentType,
    })
  );
  return key;
}

/** R2 연결 상태 확인 (읽기 권한 필요) */
export async function checkR2Connection() {
  await r2Client.send(
    new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME!,
      MaxKeys: 1,
    })
  );
}
