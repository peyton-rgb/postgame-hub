FROM node:20-slim

# ffmpeg: video work + image decoding. libheif-examples: heif-convert for iPhone HEIC photos.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libheif-examples && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --production
# Person detector for recap photo framing: YOLOX-Tiny (Megvii, Apache-2.0).
ADD https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_tiny.onnx /app/models/yolox_tiny.onnx
COPY index.js detect.js ./

EXPOSE 3001
CMD ["node", "index.js"]
