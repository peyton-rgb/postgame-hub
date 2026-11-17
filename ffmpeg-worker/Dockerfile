FROM node:20-slim

# ffmpeg: video work + image decoding.
# libheif-examples: heif-convert for iPhone HEIC photos. libheif-plugin-libde265
#   is the HEVC decoder heif-convert needs — it's only a "Recommends" of libheif,
#   so --no-install-recommends silently left it out and every HEIC failed.
# dcraw: camera raw photos (Canon .cr2, Nikon .nef, Sony .arw, .dng ...).
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libheif-examples libheif-plugin-libde265 dcraw && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --production
# Person detector for recap photo framing: YOLOX-Tiny (Megvii, Apache-2.0).
ADD https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_tiny.onnx /app/models/yolox_tiny.onnx
COPY index.js detect.js ./

EXPOSE 3001
CMD ["node", "index.js"]
