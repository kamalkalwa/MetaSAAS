/**
 * File Storage Module
 *
 * Handles file uploads, downloads, and deletion.
 * Follows the provider pattern — pluggable backends with a local fallback.
 *
 * Provider: S3-compatible (AWS S3, Cloudflare R2, MinIO, Supabase Storage)
 * Fallback: LocalStorageProvider (saves to ./uploads/, no cloud config needed)
 *
 * Usage:
 *   import { initStorage, uploadFile, getFileUrl, deleteFile } from "./storage";
 *
 *   initStorage();  // Call once at startup — auto-detects provider from env
 *
 *   const result = await uploadFile({
 *     key: "avatars/user-123.png",
 *     body: fileBuffer,
 *     contentType: "image/png",
 *   });
 *
 *   const url = await getFileUrl("avatars/user-123.png");
 *   await deleteFile("avatars/user-123.png");
 */

import { mkdir, writeFile, readFile, unlink, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { createHmac } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadOptions {
  /** Object key / path (e.g., "avatars/user-123.png") */
  key: string;
  /** File content */
  body: Buffer | Uint8Array | string;
  /** MIME type */
  contentType: string;
}

export interface UploadResult {
  /** Object key */
  key: string;
  /** Public or signed URL to access the file */
  url: string;
  /** Whether the upload succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

export interface StorageProvider {
  /** Provider name (for logging) */
  readonly name: string;
  /** Upload a file */
  upload(options: UploadOptions): Promise<UploadResult>;
  /** Get a URL for a file (signed or public) */
  getUrl(key: string): Promise<string>;
  /** Delete a file */
  delete(key: string): Promise<boolean>;
  /** Check if a file exists */
  exists(key: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Local Storage Provider (dev fallback — no cloud config needed)
// ---------------------------------------------------------------------------

export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  private basePath: string;
  private baseUrl: string;

  constructor(basePath = "./uploads", baseUrl = "/api/files") {
    this.basePath = basePath;
    this.baseUrl = baseUrl;
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    try {
      const filePath = join(this.basePath, options.key);
      await mkdir(dirname(filePath), { recursive: true });

      const data =
        typeof options.body === "string"
          ? Buffer.from(options.body)
          : options.body;

      await writeFile(filePath, data);

      return {
        key: options.key,
        url: `${this.baseUrl}/${options.key}`,
        success: true,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[storage:local] Upload failed: ${message}`);
      return { key: options.key, url: "", success: false, error: message };
    }
  }

  async getUrl(key: string): Promise<string> {
    return `${this.baseUrl}/${key}`;
  }

  async delete(key: string): Promise<boolean> {
    try {
      await unlink(join(this.basePath, key));
      return true;
    } catch {
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(join(this.basePath, key));
      return true;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// S3-Compatible Storage Provider
// ---------------------------------------------------------------------------

/**
 * S3-compatible storage provider.
 * Works with AWS S3, Cloudflare R2, MinIO, and any S3-compatible service.
 *
 * Uses raw HTTP with AWS Signature V4 — no SDK dependency needed.
 * For simplicity, uses PUT for uploads and GET for downloads.
 */
export class S3StorageProvider implements StorageProvider {
  readonly name = "s3";
  private endpoint: string;
  private bucket: string;
  private accessKey: string;
  private secretKey: string;
  private region: string;
  private publicUrl?: string;

  constructor(config: {
    endpoint: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    region?: string;
    publicUrl?: string;
  }) {
    this.endpoint = config.endpoint.replace(/\/$/, "");
    this.bucket = config.bucket;
    this.accessKey = config.accessKey;
    this.secretKey = config.secretKey;
    this.region = config.region ?? "auto";
    this.publicUrl = config.publicUrl;
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    try {
      const url = `${this.endpoint}/${this.bucket}/${options.key}`;
      const body =
        typeof options.body === "string"
          ? Buffer.from(options.body)
          : Buffer.from(options.body);

      const date = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z/, "Z");
      const dateShort = date.slice(0, 8);

      // AWS Signature V4 (simplified for PUT)
      const headers: Record<string, string> = {
        "Content-Type": options.contentType,
        "x-amz-date": date,
        "x-amz-content-sha256": createHmac("sha256", "").update(body).digest("hex"),
        Host: new URL(this.endpoint).host,
      };

      const signedHeaders = Object.keys(headers).sort().join(";");
      const canonicalHeaders = Object.keys(headers)
        .sort()
        .map((k) => `${k.toLowerCase()}:${headers[k]}`)
        .join("\n");

      const canonicalRequest = [
        "PUT",
        `/${this.bucket}/${options.key}`,
        "",
        canonicalHeaders + "\n",
        signedHeaders,
        headers["x-amz-content-sha256"],
      ].join("\n");

      const scope = `${dateShort}/${this.region}/s3/aws4_request`;
      const stringToSign = [
        "AWS4-HMAC-SHA256",
        date,
        scope,
        createHmac("sha256", "").update(canonicalRequest).digest("hex"),
      ].join("\n");

      // Derive signing key
      let signingKey = Buffer.from(`AWS4${this.secretKey}`);
      for (const part of [dateShort, this.region, "s3", "aws4_request"]) {
        signingKey = Buffer.from(
          createHmac("sha256", signingKey).update(part).digest()
        );
      }

      const signature = createHmac("sha256", signingKey)
        .update(stringToSign)
        .digest("hex");

      headers[
        "Authorization"
      ] = `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

      const response = await fetch(url, {
        method: "PUT",
        headers,
        body,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[storage:s3] Upload failed ${response.status}: ${errorBody}`);
        return {
          key: options.key,
          url: "",
          success: false,
          error: `S3 upload error: ${response.status}`,
        };
      }

      const fileUrl = this.publicUrl
        ? `${this.publicUrl}/${options.key}`
        : `${this.endpoint}/${this.bucket}/${options.key}`;

      return { key: options.key, url: fileUrl, success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[storage:s3] Upload failed: ${message}`);
      return { key: options.key, url: "", success: false, error: message };
    }
  }

  async getUrl(key: string): Promise<string> {
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }
    return `${this.endpoint}/${this.bucket}/${key}`;
  }

  async delete(key: string): Promise<boolean> {
    try {
      const url = `${this.endpoint}/${this.bucket}/${key}`;
      const response = await fetch(url, { method: "DELETE" });
      return response.ok;
    } catch {
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const url = `${this.endpoint}/${this.bucket}/${key}`;
      const response = await fetch(url, { method: "HEAD" });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let storageProvider: StorageProvider = new LocalStorageProvider();

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the storage module.
 * Auto-detects provider from environment variables:
 *   - STORAGE_ENDPOINT set → S3-compatible provider
 *   - Otherwise → Local provider (saves to ./uploads/)
 *
 * Safe to call multiple times. Never throws.
 */
export function initStorage(): void {
  const endpoint = process.env.STORAGE_ENDPOINT;
  const bucket = process.env.STORAGE_BUCKET;
  const accessKey = process.env.STORAGE_ACCESS_KEY;
  const secretKey = process.env.STORAGE_SECRET_KEY;

  if (endpoint && bucket && accessKey && secretKey) {
    storageProvider = new S3StorageProvider({
      endpoint,
      bucket,
      accessKey,
      secretKey,
      region: process.env.STORAGE_REGION,
      publicUrl: process.env.STORAGE_PUBLIC_URL,
    });
    console.log(`[storage] Initialized with S3-compatible provider (bucket: ${bucket})`);
  } else {
    storageProvider = new LocalStorageProvider();
    console.log("[storage] No STORAGE_ENDPOINT — using local provider (files saved to ./uploads/)");
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Upload a file to storage.
 */
export async function uploadFile(options: UploadOptions): Promise<UploadResult> {
  return storageProvider.upload(options);
}

/**
 * Get a URL for an uploaded file.
 */
export async function getFileUrl(key: string): Promise<string> {
  return storageProvider.getUrl(key);
}

/**
 * Delete a file from storage.
 */
export async function deleteFile(key: string): Promise<boolean> {
  return storageProvider.delete(key);
}

/**
 * Check if a file exists in storage.
 */
export async function fileExists(key: string): Promise<boolean> {
  return storageProvider.exists(key);
}

/**
 * Get the current storage provider (for testing/inspection).
 */
export function getStorageProvider(): StorageProvider {
  return storageProvider;
}

/**
 * Override the storage provider (for testing).
 */
export function setStorageProvider(p: StorageProvider): void {
  storageProvider = p;
}

// ---------------------------------------------------------------------------
// Testing Helpers
// ---------------------------------------------------------------------------

/**
 * Reset storage module state (for testing only).
 */
export function resetStorage(): void {
  storageProvider = new LocalStorageProvider();
}
