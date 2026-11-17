FROM node:20-slim

# ffmpeg: video work + image decoding.
# libheif-examples: heif-convert for iPhone HEIC photos. On Debian bookworm the
#   HEVC decoder (libde265) is built into libheif1 — there's no separate plugin
#   package. iPhone portrait-mode files that libheif rejects fall back to the
#   heic-convert npm package in detect.js.
# dcraw: camera raw photos (Canon .cr2, Nikon .nef, Sony .arw, .dng ...).
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libheif-examples dcraw && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --production
# Person detector for recap photo framing: YOLOX-Tiny (Megvii, Apache-2.0).
ADD https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_tiny.onnx /app/models/yolox_tiny.onnx
COPY index.js detect.js ./

EXPOSE 3001
CMD ["node", "index.js"]
