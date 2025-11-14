// config/gridfs.js
import mongoose from "mongoose";
import multer from "multer";
import { GridFSBucket } from "mongodb";
import { Readable } from "stream";

let gfs;
let bucket;

mongoose.connection.once("open", () => {
  bucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: "uploads",
  });
  console.log("✔ GridFS Bucket ready");
});

// Multer memory storage (files stay in RAM, NOT saved to disk)
const storage = multer.memoryStorage();
export const upload = multer({ storage });

// Upload function to GridFS manually
export const uploadToGridFS = (file) => {
  return new Promise((resolve, reject) => {
    const readableStream = new Readable();
    readableStream.push(file.buffer);
    readableStream.push(null);

    const uploadStream = bucket.openUploadStream(file.originalname, {
      contentType: file.mimetype,
    });

    readableStream.pipe(uploadStream)
      .on("error", reject)
      .on("finish", () => resolve(uploadStream.id.toString()));
  });
};

// Read image by ID
export const getImageStream = (id) => {
  return bucket.openDownloadStream(new mongoose.Types.ObjectId(id));
};
