import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function createVideos(flowName: string, framesDir: string, outDir: string) {
  const movPath = path.join(outDir, `${flowName}.mov`);
  const mp4Path = path.join(outDir, `${flowName}.mp4`);
  
  // Create ProRes 422, downscaled to 1080p
  console.log(`Generating ProRes for ${flowName}...`);
  await execAsync(`ffmpeg -y -framerate 30 -i "${framesDir}/frame-%05d.png" -c:v prores_ks -profile:v 2 -vf scale=1920:1080 -pix_fmt yuv422p10le "${movPath}"`);

  // Create H.264, downscaled to 1080p
  console.log(`Generating H.264 for ${flowName}...`);
  await execAsync(`ffmpeg -y -framerate 30 -i "${framesDir}/frame-%05d.png" -c:v libx264 -vf scale=1920:1080 -pix_fmt yuv420p "${mp4Path}"`);
}

export async function conformVideo(flowName: string, inputVideo: string, outDir: string) {
  const movPath = path.join(outDir, `${flowName}.mov`);
  const mp4Path = path.join(outDir, `${flowName}.mp4`);
  
  // Conform to 30fps and downscale to 1080p
  console.log(`Conforming ProRes for ${flowName}...`);
  await execAsync(`ffmpeg -y -i "${inputVideo}" -r 30 -c:v prores_ks -profile:v 2 -vf scale=1920:1080 -pix_fmt yuv422p10le "${movPath}"`);

  console.log(`Conforming H.264 for ${flowName}...`);
  await execAsync(`ffmpeg -y -i "${inputVideo}" -r 30 -c:v libx264 -vf scale=1920:1080 -pix_fmt yuv420p "${mp4Path}"`);
}

export async function extractPoster(flowName: string, inputPath: string, outDir: string) {
  const posterPath = path.join(outDir, `${flowName}-poster.png`);
  console.log(`Extracting poster for ${flowName}...`);
  // Take a frame exactly halfway through
  await execAsync(`ffmpeg -y -i "${inputPath}" -vf "thumbnail,scale=1920:1080" -frames:v 1 "${posterPath}"`);
}
