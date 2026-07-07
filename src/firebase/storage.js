import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { storage } from "./config";

// ── Upload single image ───────────────────────────────
export const uploadImage = (file, path, onProgress) => {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      "state_changed",
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        onProgress?.(pct);
      },
      (err) => reject(err),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      },
    );
  });
};

// ── Delete image by URL ───────────────────────────────
export const deleteImage = async (url) => {
  try {
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
  } catch {}
};

// ── Upload multiple images ────────────────────────────
export const uploadImages = async (files, basePath, onProgress) => {
  const urls = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = `${basePath}/${Date.now()}_${file.name}`;
    const url = await uploadImage(file, path, (pct) => {
      onProgress?.(i, files.length, pct);
    });
    urls.push(url);
  }
  return urls;
};
