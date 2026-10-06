// Centralized Media Storage and Cleanup Utility
// Handles asset deletion and uploading across Cloudinary (images, videos, audio) and local disk fallback

const fs = require("fs");
const path = require("path");
const cloudinary = require("../config/cloudinary");

/**
 * Extracts the Cloudinary public_id from a secure or standard URL.
 * Handles:
 * - Nested folder structures (e.g. "IntellMeet_prs/recordings/sample")
 * - URL versions (e.g. "/v1743934823/")
 * - Transformation params (e.g. "/c_fill,w_300/")
 * - Strips file extensions (.webm, .mp4, .jpg, .png, etc.)
 */
const extractPublicId = (url) => {
  if (!url || typeof url !== "string") return null;
  if (!url.includes("cloudinary.com")) return null;

  try {
    const uploadIndex = url.indexOf("/upload/");
    if (uploadIndex === -1) return null;

    let pathAfterUpload = url.substring(uploadIndex + "/upload/".length);

    // Remove query params or hashes if present
    pathAfterUpload = pathAfterUpload.split("?")[0].split("#")[0];

    const segments = pathAfterUpload.split("/");
    const validSegments = [];

    for (const segment of segments) {
      if (!segment) continue;

      // Ignore version tags like v1743934823
      if (/^v\d+$/.test(segment)) {
        continue;
      }

      // Ignore transformation tags (contains commas or standard Cloudinary short flags)
      if (
        segment.includes(",") ||
        /^(?:[a-z]{1,2}_|e_|fl_|o_|bo_)[a-zA-Z0-9_,-]+$/.test(segment)
      ) {
        continue;
      }

      validSegments.push(segment);
    }

    if (validSegments.length === 0) return null;

    // Join remaining segments and strip extension
    const fullPath = validSegments.join("/");
    return fullPath.replace(/\.[a-zA-Z0-9]+$/, "");
  } catch (err) {
    console.warn("[MediaStorage] Failed to extract publicId:", err.message);
    return null;
  }
};

/**
 * Detects the resource_type required by Cloudinary for destroying/uploading assets.
 * Cloudinary strictly categorizes audio and video as "video".
 */
const detectResourceType = (url) => {
  if (!url || typeof url !== "string") return "image";
  const lower = url.toLowerCase();

  if (lower.includes("/video/upload/")) return "video";
  if (lower.includes("/raw/upload/")) return "raw";
  if (lower.includes("/image/upload/")) return "image";

  if (/\.(webm|mp4|mov|mkv|avi|flv|m4v|mp3|wav|ogg|aac|m4a)$/i.test(lower)) {
    return "video";
  }

  if (/\.(pdf|zip|tar|gz|txt|doc|docx)$/i.test(lower)) {
    return "raw";
  }

  return "image";
};

/**
 * Uploads a buffer to Cloudinary with customizable folder and resource_type.
 */
const uploadToCloudinary = (buffer, options = {}) => {
  const baseFolder = process.env.CLOUDINARY_FOLDER || "IntellMeet_prs";
  const subfolder = options.subfolder || "avatars";
  const resourceType = options.resource_type || "image";
  const folder = options.folder || `${baseFolder}/${subfolder}`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) {
          console.error("[MediaStorage] Cloudinary upload stream error:", error);
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    stream.end(buffer);
  });
};

/**
 * Permanently removes a media asset from Cloudinary (image/video/raw) or local disk.
 * Safe operation: will not throw errors or crash caller if file already missing.
 */
const deleteMediaFile = async (url) => {
  if (!url || typeof url !== "string") {
    return { success: false, reason: "No media URL or file path provided" };
  }

  // 1. Cloudinary Asset Cleanup
  if (url.includes("cloudinary.com")) {
    try {
      const publicId = extractPublicId(url);
      if (!publicId) {
        console.warn("[MediaStorage] Cloudinary URL missing identifiable publicId:", url);
        return { success: false, reason: "Invalid Cloudinary public ID" };
      }

      const resourceType = detectResourceType(url);
      console.log(`[MediaStorage] Deleting Cloudinary asset: [${resourceType}] ${publicId}`);

      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      });

      // If destroy returned "not found", attempt opposite resource type as fallback
      if (result && result.result === "not found") {
        const fallbackType = resourceType === "video" ? "image" : "video";
        console.log(`[MediaStorage] Retrying deletion with fallback resource_type: ${fallbackType}`);
        const fallbackResult = await cloudinary.uploader.destroy(publicId, {
          resource_type: fallbackType,
          invalidate: true,
        });
        return { success: true, provider: "cloudinary", publicId, result: fallbackResult };
      }

      return { success: true, provider: "cloudinary", publicId, result };
    } catch (err) {
      console.error("[MediaStorage] Error deleting from Cloudinary:", err.message);
      return { success: false, provider: "cloudinary", error: err.message };
    }
  }

  // 2. Local File System Cleanup (/uploads/...)
  if (url.includes("/uploads/")) {
    try {
      const uploadIdx = url.indexOf("/uploads/");
      const relativeSubpath = url.substring(uploadIdx + "/uploads/".length);
      const filePath = path.join(__dirname, "../../uploads", relativeSubpath);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[MediaStorage] Deleted local file: ${filePath}`);
        return { success: true, provider: "local", filePath };
      } else {
        console.warn(`[MediaStorage] Local file not found on disk: ${filePath}`);
        return { success: false, provider: "local", reason: "File does not exist" };
      }
    } catch (err) {
      console.error("[MediaStorage] Error deleting local file:", err.message);
      return { success: false, provider: "local", error: err.message };
    }
  }

  return { success: false, reason: "Unrecognized media URL or storage provider" };
};

module.exports = {
  extractPublicId,
  detectResourceType,
  uploadToCloudinary,
  deleteMediaFile,
};
